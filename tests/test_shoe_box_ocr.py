import unittest
from unittest.mock import Mock

from PIL import Image

from shoe_box_ocr import (
    _apply_article_consensus,
    _detect_boxes,
    _draw_highlighted_boxes,
    _easyocr_text,
    _spatial_grid_is_valid,
    _spatial_size_grid,
    clean_label_text,
    format_report,
    parse_product_text,
)


class ProductTextParserTests(unittest.TestCase):
    def test_art_colour_and_labeled_grid(self):
        result = parse_product_text(
            """
            SHOE CARTON
            ART NO: CF005
            COLOUR: L.BEIGE
            SIZES: 37 38 39 40
            QUANTITIES: 1 2 2 1
            """
        )

        self.assertEqual(result["art_no"], "CF005")
        self.assertEqual(result["colour"], "L.BEIGE")
        self.assertEqual(result["sizes"], {"37": 1, "38": 2, "39": 2, "40": 1})
        self.assertEqual(
            result["size_table"],
            {"sizes": ["37", "38", "39", "40"], "quantities": [1, 2, 2, 1]},
        )

    def test_style_and_adjacent_grid(self):
        result = parse_product_text(
            """
            STYLE NO: 699-59
            COLOR: BROWN
            SIZE
            36 37 38 39 40
            1 1 2 1 1
            """
        )

        self.assertEqual(result["art_no"], "699-59")
        self.assertEqual(result["colour"], "BROWN")
        self.assertEqual(
            result["sizes"], {"36": 1, "37": 1, "38": 2, "39": 1, "40": 1}
        )

    def test_unlabeled_model_code_and_normalization(self):
        result = parse_product_text(
            "d1836-h9438\ncolor: black\nsizes: 37 38 39\nqty: 2 1 3"
        )

        self.assertEqual(result["art_no"], "D1836-H9438")
        self.assertEqual(result["colour"], "BLACK")
        self.assertEqual(result["sizes"], {"37": 2, "38": 1, "39": 3})
        self.assertEqual(result["raw_text"], result["raw_text"].upper())

    def test_carton_misspelled_collor(self):
        result = parse_product_text(
            "ART NO: CF005\nCOLLOR: L.BEIGE\n37 38 39 40\n1 2 2 1"
        )

        self.assertEqual(result["art_no"], "CF005")
        self.assertEqual(result["colour"], "L.BEIGE")
        self.assertEqual(result["sizes"], {"37": 1, "38": 2, "39": 2, "40": 1})

    def test_real_carton_ocr_split_lines_and_typos(self):
        result = parse_product_text(
            """
            ART NC:
            CF 005
            GOLOR;
            L_BEIGE
            37 38 39 40
            1
            2
            2
            1
            PRS
            QTY:
            6
            """
        )

        self.assertEqual(result["art_no"], "CF005")
        self.assertEqual(result["colour"], "L_BEIGE")
        self.assertEqual(result["sizes"], {"37": 1, "38": 2, "39": 2, "40": 1})

    def test_rejects_size_grid_that_disagrees_with_declared_quantity(self):
        result = parse_product_text(
            "ART NC:\nCF005\nCOLOR:;\nLBEIGE\n37 38 39 40\n17 2 2 1\nQTY:\n6"
        )

        self.assertEqual(result["colour"], "LBEIGE")
        self.assertEqual(result["sizes"], {})

    def test_infers_unlabelled_and_fuzzy_colour_from_raw_text(self):
        result = parse_product_text("D1836-49438\nBIACK\n8997-024")

        self.assertEqual(result["colour"], "BLACK")

    def test_colour_label_does_not_capture_article_number(self):
        result = parse_product_text(
            "ART\nNO\nCOLOUR\nZL-6419-11\nBLACK\nSIZE: 36 37 38"
        )

        self.assertEqual(result["colour"], "BLACK")

    def test_sticker_only_article_and_colour(self):
        result = parse_product_text(
            "EAC\nART NO:\nLH78220 SILVER\nCOLOUR:\nSIZE: 36 37 38 39 40 41"
        )

        self.assertEqual(result["art_no"], "LH78220")
        self.assertEqual(result["colour"], "SILVER")

    def test_empty_colour_label_does_not_capture_prs(self):
        result = parse_product_text(
            "ART NO:\nLH78220\nCOLOUR:\nSIZE: 36 37 38 39 40 41\nPRS\nQTY:\n6"
        )

        self.assertIsNone(result["colour"])

    def test_art_label_does_not_jump_to_colour_on_later_line(self):
        result = parse_product_text("ART NO:\nSILVER\nCOLOUR:\nSIZE: 36 37 38")

        self.assertIsNone(result["art_no"])
        self.assertEqual(result["colour"], "SILVER")

    def test_custom_abbreviated_colour(self):
        result = parse_product_text("EAC K3322\nLGRAY\nART NO.\nCOLOUR:")

        self.assertEqual(result["colour"], "LGRAY")

    def test_fuzzy_colour_with_inserted_ocr_character(self):
        result = parse_product_text("ART NO: LH78220\nWNHITE")

        self.assertEqual(result["colour"], "WHITE")

    def test_labeled_numeric_article(self):
        result = parse_product_text("ART\nNO:\n470226\nCOLOUR:\nWHITE")

        self.assertEqual(result["art_no"], "470226")

    def test_missing_article_does_not_use_quantity_row(self):
        result = parse_product_text(
            "ART NO:\nCOLOUR:\nSIZE: 36 37 38 39\n1 2 2 1\nQTY:\n6"
        )

        self.assertIsNone(result["art_no"])

    def test_compact_size_row(self):
        result = parse_product_text(
            "EAC K3322\nWHITE\nSIZE: 37383940\n1 2 2 1\nQTY:\n6"
        )

        self.assertEqual(result["art_no"], "K3322")
        self.assertEqual(result["colour"], "WHITE")
        self.assertEqual(result["sizes"], {"37": 1, "38": 2, "39": 2, "40": 1})
        self.assertEqual(result["available_sizes"], ["37", "38", "39", "40"])

    def test_repairs_obvious_size_38_ocr_error(self):
        result = parse_product_text("SIZE: 36 37 88 39 40 41\n1 2 2 1 0 0")

        self.assertEqual(
            result["sizes"],
            {"36": 1, "37": 2, "38": 2, "39": 1, "40": 0, "41": 0},
        )

    def test_art_no_ocr_underscore_is_not_an_article(self):
        result = parse_product_text("EAC\nK3322\nART NO_\nCOLOUR:\nWHITE")

        self.assertEqual(result["art_no"], "K3322")


class LocalImagePipelineTests(unittest.TestCase):
    def test_clean_label_text_normalizes_noisy_product_label(self):
        cleaned = clean_label_text(
            """
            ARTNO; K3322
            L.GRAY
            SIZE 37388940
            OTY
            I 2 2 I
            PRS 6
            JW
            MEAS 62,S XT7 8O.5 CM
            """
        )

        self.assertEqual(
            cleaned,
            "ART NO: K3322\n"
            "COLOUR: LGRAY\n"
            "\n"
            "SIZE: 37 38 39 40\n"
            "QTY: 1 2 2 1\n"
            "\n"
            "PRS: 6\n"
            "\n"
            "MEAS: 62.5 X 17 X 30.5 CM",
        )

    def test_clean_label_text_returns_no_product_data_for_noise(self):
        cleaned = clean_label_text('"\nJW\n1"N\n1"9\nLD\nV\nIS\n"')

        self.assertEqual(cleaned, "NO_PRODUCT_DATA")

    def test_draw_highlighted_boxes_marks_detected_regions(self):
        image = Image.new("RGB", (120, 80), "white")
        annotated = _draw_highlighted_boxes(
            image,
            [
                {
                    "has_product_data": True,
                    "detection": {"box": [10, 10, 60, 50]},
                },
                {
                    "has_product_data": False,
                    "detection": {"box": [70, 15, 110, 55]},
                },
            ],
        )

        self.assertNotEqual(annotated.getpixel((10, 10)), image.getpixel((10, 10)))
        self.assertNotEqual(annotated.getpixel((70, 15)), image.getpixel((70, 15)))

    def test_format_report_only_includes_raw_text_and_product_flag_per_box(self):
        report = format_report(
            {
                "box_count": 2,
                "product_box_count": 1,
                "boxes": [
                    {
                        "raw_text": "ART NO: CF005\nCOLOUR: L.BEIGE",
                        "has_product_data": True,
                        "art_no": "CF005",
                        "colour": "L.BEIGE",
                    },
                    {
                        "raw_text": "RANDOM TEXT",
                        "has_product_data": False,
                        "art_no": None,
                        "colour": None,
                    },
                ],
            }
        )

        self.assertIn("boxes_detected: 2", report)
        self.assertIn("boxes_with_product_data: 1", report)
        self.assertIn("[box 1]", report)
        self.assertIn("raw_text:\nART NO: CF005\nCOLOUR: L.BEIGE", report)
        self.assertIn("has_product_data: true", report)
        self.assertIn("[box 2]", report)
        self.assertIn("raw_text:\nRANDOM TEXT", report)
        self.assertIn("has_product_data: false", report)
        self.assertNotIn("art_no:", report)
        self.assertNotIn("colour:", report)

    def test_easyocr_text_sorts_lines_and_discards_very_low_confidence(self):
        reader = Mock()
        reader.readtext.return_value = [
            ([[0, 20], [10, 20], [10, 30], [0, 30]], "QTY: 1 2", 0.9),
            ([[0, 0], [10, 0], [10, 10], [0, 10]], "SIZE: 37 38", 0.8),
            ([[0, 40], [10, 40], [10, 50], [0, 50]], "NOISE", 0.1),
        ]

        text = _easyocr_text(reader, Image.new("RGB", (20, 20), "white"))

        self.assertEqual(text, "SIZE: 37 38\nQTY: 1 2")

    def test_detect_boxes_returns_empty_when_nothing_is_found(self):
        class DeviceInputs(dict):
            def to(self, device):
                return self

        image = Mock()
        image.size = (100, 80)
        image.width = 100
        image.height = 80
        processor = Mock()
        inputs = DeviceInputs(input_ids=Mock())
        processor.return_value = inputs
        processor.post_process_grounded_object_detection.return_value = [
            {"boxes": [], "scores": [], "labels": []}
        ]
        detector = Mock()
        detector.return_value = Mock()

        detections = _detect_boxes(image, processor, detector, "cpu")

        self.assertEqual(detections, [])

    def test_spatial_grid_preserves_blank_quantity_columns_as_zero(self):
        def box(left, top, right, bottom):
            return [[left, top], [right, top], [right, bottom], [left, bottom]]

        detections = [
            (box(0, 0, 700, 40), "35 36 37 38 39 40 41", 0.9),
            (box(30, 80, 70, 120), "1", 0.9),
            (box(130, 80, 170, 120), "2", 0.9),
            (box(330, 80, 370, 120), "2", 0.9),
            (box(630, 80, 670, 120), "2", 0.9),
        ]

        grid = _spatial_size_grid(detections)

        self.assertEqual(
            grid,
            {"35": 1, "36": 2, "37": 0, "38": 2, "39": 0, "40": 0, "41": 2},
        )

    def test_spatial_grid_with_only_zero_noise_is_not_useful(self):
        def box(left, top, right, bottom):
            return [[left, top], [right, top], [right, bottom], [left, bottom]]

        detections = [
            (box(0, 0, 600, 40), "36 37 38 39 40 41", 0.9),
            (box(0, 80, 80, 120), "0", 0.9),
        ]

        grid = _spatial_size_grid(detections)

        self.assertEqual(sum(grid.values()), 0)

    def test_sparse_spatial_grid_requires_matching_declared_quantity(self):
        grid = {"36": 0, "37": 1, "38": 2, "39": 2, "40": 1, "41": 0}

        self.assertTrue(_spatial_grid_is_valid(grid, 6))
        self.assertFalse(_spatial_grid_is_valid(grid, 7))
        self.assertFalse(_spatial_grid_is_valid(grid, None))

    def test_complete_spatial_grid_can_work_without_declared_quantity(self):
        self.assertTrue(_spatial_grid_is_valid({"37": 1, "38": 2}, None))

    def test_article_consensus_corrects_single_character_ocr_error(self):
        boxes = [
            {"art_no": "LH78220"},
            {"art_no": "LH78220"},
            {"art_no": "LH76220"},
        ]

        _apply_article_consensus(boxes)

        self.assertEqual(boxes[2]["art_no"], "LH78220")
        self.assertEqual(boxes[2]["art_no_raw"], "LH76220")


if __name__ == "__main__":
    unittest.main()
