'use client';

import { useState, useCallback, useEffect } from 'react';
import { api, Product, Metadata, ProductLookup } from '@/lib/api';
import { X, Plus, Minus, ChevronRight, ChevronLeft } from 'lucide-react';
import { SHOE_SIZES } from '@/lib/constants';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => Promise<void>;
  editingProduct?: Product;
  metadata: Metadata;
  isSubmitting?: boolean;
}

type Step = 'basic' | 'details' | 'pricing' | 'images' | 'inventory';

const STEPS: { id: Step; label: string }[] = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'details', label: 'Details' },
  { id: 'images', label: 'Images' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'inventory', label: 'Inventory' },
];

const emptyProductForm = (): Product => ({
  artNo: '',
  name: '',
  type: '',
  seasons: [],
  colour: '',
  material: '',
  price: '' as unknown as number,
  landingPrice: '' as unknown as number,
  inventory: SHOE_SIZES.map((size) => ({
    size,
    quantity: 0,
  })),
  box_quantity: 0,
  images: [],
});

export function AddProductModal({
  isOpen,
  onClose,
  onSave,
  editingProduct,
  metadata,
  isSubmitting = false,
}: AddProductModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('basic');
  const [formData, setFormData] = useState<Product>(
    editingProduct || emptyProductForm()
  );

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [artLookup, setArtLookup] = useState<ProductLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const cleanupTempImages = useCallback((images: Product['images']) => {
    images
      .filter((image) => image.tempId)
      .forEach((image) => {
        api.deleteTempProductImage(image.tempId!).catch((error) => {
          console.error('[v0] Failed to delete temporary image:', error);
        });
      });
  }, []);

  const handleFieldChange = useCallback((field: keyof Product, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setUnsavedChanges(true);
    setSubmitError(null);
  }, []);

  const handleArtNoChange = (value: string) => {
    setArtLookup(null);
    handleFieldChange('artNo', value);
  };

  const handleSeasonToggle = (season: string) => {
    setFormData((prev) => ({
      ...prev,
      seasons: prev.seasons.includes(season)
        ? prev.seasons.filter((s) => s !== season)
        : [...prev.seasons, season],
    }));
    setUnsavedChanges(true);
    setSubmitError(null);
  };

  const handleInventoryChange = (size: number, quantity: number) => {
    setFormData((prev) => ({
      ...prev,
      inventory: prev.inventory.map((item) =>
        item.size === size ? { ...item, quantity: Math.max(0, quantity) } : item
      ),
    }));
    setUnsavedChanges(true);
    setSubmitError(null);
  };

  const handleBoxQuantityChange = (value: string) => {
    if (!/^\d*$/.test(value)) return;

    handleFieldChange('box_quantity', value === '' ? undefined : Number(value));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const localId = `${Date.now()}-${file.name}-${Math.random()}`;
      const reader = new FileReader();
      reader.onload = async (event) => {
        const preview = event.target?.result as string;
        setFormData((prev) => ({
          ...prev,
          images: [
            ...prev.images,
            {
              name: file.name,
              type: file.type,
              path: preview,
              tempId: localId,
              uploading: true,
            },
          ],
        }));

        try {
          const uploadedImage = await api.uploadTempProductImage(file);
          setFormData((prev) => ({
            ...prev,
            images: prev.images.map((image) =>
              image.tempId === localId
                ? { ...uploadedImage, uploading: false }
                : image
            ),
          }));
        } catch (error) {
          setFormData((prev) => ({
            ...prev,
            images: prev.images.map((image) =>
              image.tempId === localId
                ? {
                    ...image,
                    uploading: false,
                    error: error instanceof Error ? error.message : 'Upload failed',
                  }
                : image
            ),
          }));
        }
      };
      reader.readAsDataURL(file);
    });
    e.currentTarget.value = '';
    setUnsavedChanges(true);
    setSubmitError(null);
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => {
      const image = prev.images[index];
      if (image?.tempId && !image.uploading && !image.error) {
        api.deleteTempProductImage(image.tempId).catch((error) => {
          console.error('[v0] Failed to delete temporary image:', error);
        });
      }
      return {
        ...prev,
        images: prev.images.filter((_, i) => i !== index),
      };
    });
    setUnsavedChanges(true);
    setSubmitError(null);
  };

  const goToStep = (step: Step) => {
    if (exactVariant && (step === 'pricing' || step === 'images')) {
      setCurrentStep('inventory');
      return;
    }
    setCurrentStep(step);
  };

  const nextStep = () => {
    const currentIndex = visibleSteps.findIndex((s) => s.id === currentStep);
    if (currentIndex < visibleSteps.length - 1) {
      setCurrentStep(visibleSteps[currentIndex + 1].id);
    }
  };

  const prevStep = () => {
    const currentIndex = visibleSteps.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(visibleSteps[currentIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    if (!formData.artNo || !formData.type || !formData.colour || !formData.material) {
      setSubmitError('Please fill in all required fields.');
      return;
    }
    if (!formData.seasons.length) {
      setSubmitError('Please select at least one season.');
      return;
    }
    if (formData.images.some((image) => image.uploading)) {
      setSubmitError('Please wait until image uploads finish.');
      return;
    }
    if (formData.images.some((image) => image.error)) {
      setSubmitError('Remove failed image uploads before saving.');
      return;
    }
    try {
      setSubmitError(null);
      await onSave({
        ...formData,
        box_quantity: Math.max(0, Math.floor(Number(formData.box_quantity || 0))),
        images: formData.images.map(({ uploading, error, data, ...image }) => image),
      });
      setFormData(emptyProductForm());
      setUnsavedChanges(false);
      setArtLookup(null);
      setCurrentStep('basic');
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save product.');
      console.error('[v0] Error saving product:', error);
    }
  };

  const handleClose = () => {
    if (unsavedChanges && !window.confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
    setFormData(emptyProductForm());
    setUnsavedChanges(false);
    setSubmitError(null);
    setArtLookup(null);
    setCurrentStep('basic');
    cleanupTempImages(formData.images);
    onClose();
  };

  const normalizedColour = formData.colour.trim().toLowerCase();
  const normalizedMaterial = formData.material.trim().toLowerCase();
  const exactVariant =
    artLookup?.variants.find(
      (variant) =>
        variant.colour.toLowerCase() === normalizedColour &&
        variant.material.toLowerCase() === normalizedMaterial
    ) || null;
  const visibleSteps = exactVariant
    ? STEPS.filter((step) => !['pricing', 'images'].includes(step.id))
    : STEPS;
  const currentStepIndex = visibleSteps.findIndex((s) => s.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === visibleSteps.length - 1;

  const totalInventory = formData.inventory.reduce((sum, item) => sum + item.quantity, 0);
  const boxQuantity = formData.box_quantity ?? '';
  const sellingPrice = Number(formData.price || 0);
  const landingPrice = Number(formData.landingPrice || 0);
  const hasUploadingImages = formData.images.some((image) => image.uploading);
  const hasFailedImages = formData.images.some((image) => image.error);
  const hasExistingArt = Boolean(artLookup?.product);
  const suggestedColours = artLookup?.colours || [];
  const suggestedMaterials = normalizedColour
    ? [
        ...new Set(
          (artLookup?.variants || [])
            .filter((variant) => variant.colour.toLowerCase() === normalizedColour)
            .map((variant) => variant.material)
        ),
      ]
    : artLookup?.materials || [];

  useEffect(() => {
    if (!isOpen || editingProduct) return;

    const artNo = formData.artNo.trim();
    if (!artNo) {
      setArtLookup(null);
      setLookupLoading(false);
      return;
    }

    let cancelled = false;
    setLookupLoading(true);

    const timeout = window.setTimeout(async () => {
      try {
        const lookup = await api.lookupProductByArtNo(artNo);
        if (cancelled) return;

        setArtLookup(lookup);
        if (lookup?.product) {
          setFormData((prev) => ({
            ...prev,
            name: lookup.product.name,
            type: lookup.product.type,
            seasons: lookup.product.seasons,
            price: lookup.product.price,
            landingPrice: lookup.product.landingPrice,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setArtLookup(null);
          setSubmitError(error instanceof Error ? error.message : 'Failed to check art number.');
        }
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [editingProduct, formData.artNo, isOpen]);

  useEffect(() => {
    if (!exactVariant || !artLookup?.product || editingProduct) return;

    setFormData((prev) => {
      cleanupTempImages(prev.images);
      return {
        ...prev,
        price: artLookup.product.price,
        landingPrice: artLookup.product.landingPrice,
        images: [],
      };
    });
    setCurrentStep('inventory');
  }, [artLookup, cleanupTempImages, editingProduct, exactVariant]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70"
          onClick={handleClose}
        />
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="relative h-full max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={handleClose}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Progress Indicator */}
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <div className="flex gap-2">
                {visibleSteps.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => goToStep(step.id)}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      step.id === currentStep
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : index < currentStepIndex
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {index < currentStepIndex && '✓'} {step.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 200px)' }}>
              {submitError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                  {submitError}
                </div>
              )}

              {/* Step 1: Basic Info */}
              {currentStep === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Art Number <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.artNo}
                      onChange={(e) => handleArtNoChange(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                      placeholder="e.g., ART-001"
                    />
                    {lookupLoading && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Checking art number...</p>
                    )}
                    {hasExistingArt && (
                      <p className="mt-1 text-xs font-medium text-green-700 dark:text-green-300">
                        Existing art number found. Product details were filled automatically.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Product Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      disabled={hasExistingArt}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                      placeholder="e.g., Classic Sneaker"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Type <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleFieldChange('type', e.target.value)}
                      disabled={hasExistingArt}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      <option value="">Select Type</option>
                      {metadata.types.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Seasons
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {metadata.seasons.map((season) => (
                        <button
                          key={season}
                          onClick={() => handleSeasonToggle(season)}
                          disabled={hasExistingArt}
                          className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                            formData.seasons.includes(season)
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {season}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Details */}
              {currentStep === 'details' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Colour <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.colour}
                      onChange={(e) => handleFieldChange('colour', e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                      placeholder="e.g., Red, Black, etc."
                    />
                    {suggestedColours.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {suggestedColours.map((colour) => (
                          <button
                            key={colour}
                            type="button"
                            onClick={() => handleFieldChange('colour', colour)}
                            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            {colour}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Material <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.material}
                      onChange={(e) => handleFieldChange('material', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                      placeholder="e.g., Leather, Suede, etc."
                    />
                    {suggestedMaterials.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {suggestedMaterials.map((material) => (
                          <button
                            key={material}
                            type="button"
                            onClick={() => handleFieldChange('material', material)}
                            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            {material}
                          </button>
                        ))}
                      </div>
                    )}
                    {exactVariant && (
                      <p className="mt-3 rounded-lg bg-green-50 p-3 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                        This colour and material already exist for the art number. Pricing and images will be skipped; entered size quantities will be added to existing stock.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Images */}
              {currentStep === 'images' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Product Images
                    </label>
                    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-input"
                      />
                      <label htmlFor="image-input" className="cursor-pointer">
                        <div className="flex flex-col items-center">
                          <Plus className="h-8 w-8 text-gray-400" />
                          <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {formData.images.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                        Uploaded Images ({formData.images.length})
                      </p>
                      {hasUploadingImages && (
                        <p className="mb-2 text-xs text-blue-600 dark:text-blue-300">
                          Uploading images in the background...
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        {formData.images.map((image, index) => (
                          <div key={index} className="relative aspect-square">
                            <img
                              src={image.path || image.data || ''}
                              alt={`Product ${index + 1}`}
                              className="h-full w-full rounded-lg object-cover"
                            />
                            {(image.uploading || image.error) && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/55 px-2 text-center text-xs font-medium text-white">
                                {image.uploading ? 'Uploading...' : image.error}
                              </div>
                            )}
                            <button
                              onClick={() => handleRemoveImage(index)}
                              className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white hover:bg-red-700"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Pricing */}
              {currentStep === 'pricing' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Selling Price <span className="text-red-600">*</span>
                    </label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData.price}
                        onChange={(e) => handleFieldChange('price', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                        placeholder="Enter selling price"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Landing Price <span className="text-red-600">*</span>
                    </label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData.landingPrice ?? ''}
                        onChange={(e) => handleFieldChange('landingPrice', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                        placeholder="Enter landing price"
                      />
                    </div>
                  </div>

                  {sellingPrice > 0 && landingPrice > 0 && (
                    <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
                      <p className="text-xs text-blue-600 dark:text-blue-400">Profit Margin</p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                        {(sellingPrice - landingPrice).toLocaleString()} ({(((sellingPrice - landingPrice) / landingPrice) * 100).toFixed(1)}%)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Inventory */}
              {currentStep === 'inventory' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
                    <p className="text-xs text-blue-600 dark:text-blue-400">Total Stock</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {totalInventory}
                    </p>
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      Sizes & Quantities
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {formData.inventory.map((item) => (
                        <div
                          key={item.size}
                          className={`rounded-lg border-2 p-3 transition-colors ${
                            item.quantity > 0
                              ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950'
                              : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                          }`}
                        >
                          <p className="text-center text-sm font-bold text-gray-900 dark:text-gray-100">
                            Size {item.size}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-1">
                            <button
                              onClick={() => handleInventoryChange(item.size, item.quantity - 1)}
                              className="rounded bg-gray-200 p-1 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                            >
                              <Minus className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                            </button>
                            <span className="flex-1 text-center text-lg font-bold text-gray-900 dark:text-gray-100">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleInventoryChange(item.size, item.quantity + 1)}
                              className="rounded bg-blue-200 p-1 hover:bg-blue-300 dark:bg-blue-700 dark:hover:bg-blue-600"
                            >
                              <Plus className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
                    <label
                      htmlFor="box-quantity"
                      className="block text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      Box Quantity
                    </label>
                    <input
                      id="box-quantity"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={boxQuantity}
                      onChange={(event) => handleBoxQuantityChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (['-', '+', '.', ',', 'e', 'E'].includes(event.key)) {
                          event.preventDefault();
                        }
                      }}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
              <button
                onClick={prevStep}
                disabled={isFirstStep}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="inline mr-1 h-4 w-4" />
                Previous
              </button>

              {!isLastStep && (
                <button
                  onClick={nextStep}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  Next
                  <ChevronRight className="inline ml-1 h-4 w-4" />
                </button>
              )}

              {isLastStep && (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || hasUploadingImages || hasFailedImages}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700"
                >
                  {isSubmitting ? 'Saving...' : hasUploadingImages ? 'Uploading images...' : 'Save Product'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
