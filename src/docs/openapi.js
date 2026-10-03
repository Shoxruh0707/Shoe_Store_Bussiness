// Keep this contract aligned with server.js; the route coverage test detects missing operations.
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const string = { type: 'string' };
const integer = { type: 'integer', minimum: 0 };
const id = { type: 'integer', minimum: 1 };
const money = { type: 'number', minimum: 0 };
const array = items => ({ type: 'array', items });
const object = (properties, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const size = { type: 'string', enum: Array.from({ length: 12 }, (_, i) => String(i + 33)) };
const envelope = data => object({ success: { type: 'boolean', enum: [true] }, data }, ['success', 'data']);
const response = (schema, description = 'Successful response') => ({ description, content: { 'application/json': { schema } } });
const body = (schema, example) => ({ required: true, content: { 'application/json': { schema, ...(example ? { example } : {}) } } });
const query = (name, schema = string, description) => ({ name, in: 'query', schema, ...(description ? { description } : {}) });
const param = (name = 'id', schema = id) => ({ name, in: 'path', required: true, schema });
const manager = 'Requires an active store membership and admin, owner, or manager access.';
const member = 'Requires an authenticated admin or seller with an active store membership.';

const schemas = {
  Error: object({ success: { type: 'boolean', enum: [false] }, error: string, message: string }),
  User: object({ id, fname: string, lname: string, phoneNumber: string, role: string }),
  Store: object({ id, storeName: string, storeRole: string, storeImage: { type: 'string', nullable: true } }),
  Session: object({ user: ref('User'), store: { type: 'object', nullable: true, properties: { id, storeName: string, storeRole: string, storeImage: { type: 'string', nullable: true } } } }),
  Image: object({ id, name: string, type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] }, data: { type: 'string', description: 'Base64 image bytes or a data URL.' }, tempId: string, path: string }),
  InventoryRow: object({ size, quantity: integer }, ['size', 'quantity']),
  Box: object({ id, sizeRange: { type: 'string', example: '36,37x2,38', description: 'Comma-separated sizes with optional multiplicity (37x2).' }, quantity: integer }, ['sizeRange', 'quantity']),
  ProductInput: object({
    artNo: { type: 'string', minLength: 1 }, name: string,
    type: { type: 'string', enum: ['Basanochka', 'Tapochka', 'Tufli', 'Makasima', 'Skechers', 'Etik', 'Krasovka', 'Baletka'] },
    seasons: { ...array({ type: 'string', enum: ['Summer', 'Autumn', 'Winter', 'Spring'] }), minItems: 1 },
    price: money, landingPrice: money, colour: { type: 'string', minLength: 1 }, material: { type: 'string', minLength: 1 },
    price_unit: { type: 'string', enum: ['units', 'thousands'], default: 'units', description: 'thousands multiplies price inputs by 1000.' },
    inventory: array(ref('InventoryRow')), boxQuantity: { ...integer, default: 0, description: 'When positive, inventory describes the contents of each unopened box.' },
    images: array(ref('Image')), variantId: id,
  }, ['artNo', 'type', 'seasons', 'price', 'landingPrice', 'colour', 'material']),
  Product: object({ id, variantId: id, artNo: string, name: string, type: string, seasons: array(string), colour: string, material: string,
    price: { oneOf: [{ type: 'number' }, string] }, landingPrice: { oneOf: [{ type: 'number', nullable: true }, string], description: 'Decimal value; hidden from staff.' },
    quantity: integer, inventory: array(object({ size: id, quantity: integer })), boxStock: array(ref('Box')), images: array(ref('Image')),
    stockAdditions: array(object({ id, stockType: string, sizeRange: string, quantity: integer, isCancelled: { type: 'boolean' } })),
  }),
  PriceUpdate: { ...object({ artNo: string, landingPriceUpdate: money, sellingPrice: money, price_unit: { type: 'string', enum: ['units', 'thousands'] } }, ['artNo']),
    anyOf: [{ required: ['landingPriceUpdate'] }, { required: ['sellingPrice'] }] },
  SaleInput: object({
    sale_type: { type: 'string', enum: ['pair', 'box'], default: 'pair' }, art_no: string, colour_name: string, material_type: string,
    size, sold_price: money, pair_price: money, box_price: money, box_stock_id: id,
    quantity: { ...id, default: 1 }, open_box_if_needed: { type: 'boolean', default: false },
    price_unit: { type: 'string', enum: ['units', 'thousands'], default: 'units' },
  }, ['art_no', 'colour_name', 'material_type']),
  SaleResult: object({ success: { type: 'boolean' }, message: string, remaining_quantity: integer, opened_box: { type: 'boolean' } }),
  Cancellation: object({ id: string, isCancelled: { type: 'boolean' }, restoredQuantity: integer }),
};

const paths = {};
function add(method, path, operationId, tag, summary, options = {}) {
  const { schema = envelope({ type: 'object' }), status = 200, public: isPublic = false, ...details } = options;
  const responses = {
    [status]: status === 204 ? { description: 'Signed out; session cookie cleared.' } : response(schema),
    400: response(ref('Error'), 'Invalid request'),
    ...(!isPublic ? { 401: response(ref('Error'), 'Login required'), 403: response(ref('Error'), 'Insufficient store permissions') } : {}),
    404: response(ref('Error'), 'Resource not found'),
    500: response(ref('Error'), 'Internal server error'),
  };
  paths[path] ||= {};
  paths[path][method] = { operationId, tags: [tag], summary, ...(isPublic ? { security: [] } : {}), responses, ...details };
}

add('post', '/api/auth/signup', 'signup', 'Authentication', 'Create an account and your own store', {
  public: true, status: 201, schema: ref('Session'),
  description: 'Creates a seller account with owner membership in a new store and signs you in immediately. No existing API session is required. Passwords must contain at least 8 characters and at most 72 UTF-8 bytes. Clients cannot choose roles or an existing store. Phone numbers must use + followed by 7-14 digits without spaces.',
  requestBody: body(object({ fname: { type: 'string', minLength: 1, maxLength: 20 }, lname: { type: 'string', minLength: 1, maxLength: 20 }, phoneNumber: { type: 'string', pattern: '^\\+[1-9][0-9]{6,13}$', maxLength: 15 }, password: { type: 'string', format: 'password', minLength: 8, maxLength: 72 }, storeName: { type: 'string', minLength: 1, maxLength: 50 } }, ['fname', 'lname', 'phoneNumber', 'password', 'storeName']),
    { fname: 'Shoxruh', lname: 'Owner', phoneNumber: '+998901234567', password: 'choose-a-strong-password', storeName: 'My shoe store' }),
});
paths['/api/auth/signup'].post.responses[409] = response(ref('Error'), 'Phone number already registered');
paths['/api/auth/signup'].post.responses[201].headers = { 'Set-Cookie': { description: 'HTTP-only session cookie managed by the browser.', schema: string } };

add('post', '/api/auth/login', 'login', 'Authentication', 'Sign in with an existing account', {
  public: true, schema: ref('Session'),
  description: 'Execute this first. The browser stores the HTTP-only session cookie and sends it on subsequent Try it out requests. Use your application phone number and password, not the Swagger page credentials.',
  requestBody: body(object({ phoneNumber: { type: 'string', example: '+998901234567' }, password: { type: 'string', format: 'password', maxLength: 1024 } }, ['phoneNumber', 'password']), { phoneNumber: '+998901234567', password: 'your-account-password' }),
});
paths['/api/auth/login'].post.responses[401] = response(ref('Error'), 'Invalid phone number or password');
paths['/api/auth/login'].post.responses[200].headers = { 'Set-Cookie': { description: 'HTTP-only session cookie managed by the browser.', schema: string } };
add('get', '/api/auth/me', 'currentSession', 'Authentication', 'Read your current user and store', { schema: ref('Session') });
add('post', '/api/auth/signout', 'signout', 'Authentication', 'Clear the session cookie', { public: true, status: 204 });
add('get', '/api/health', 'health', 'System', 'Check database connectivity', { public: true, schema: object({ ok: { type: 'boolean' } }) });
paths['/api/health'].get.responses[503] = response(object({ ok: { type: 'boolean', enum: [false] }, message: string }), 'Database unavailable');
add('get', '/api/meta', 'metadata', 'System', 'List supported product attributes', {
  description: member, schema: envelope(object(Object.fromEntries(['types', 'shoeTypes', 'seasons', 'sizes', 'colours', 'materials'].map(key => [key, array(string)])))),
});
add('get', '/api/store', 'getStore', 'Store', 'Read the active store', { description: member, schema: envelope(ref('Store')) });
add('put', '/api/store', 'updateStore', 'Store', 'Update store settings', {
  description: manager, schema: envelope(ref('Store')),
  requestBody: body(object({ storeName: { type: 'string', minLength: 1, maxLength: 50 }, storeImage: ref('Image'), storeImagePath: string }, ['storeName']), { storeName: 'My shoe store' }),
});
add('get', '/api/products', 'listProducts', 'Products', 'List product variants in the active store', { description: member, schema: envelope(array(ref('Product'))) });
add('get', '/api/products/match', 'matchProducts', 'Products', 'Match article number, colour, and material', {
  description: member + ' Returns an empty array if any filter is missing or nothing matches.',
  parameters: ['artNo', 'colour', 'material'].map(name => query(name)), schema: envelope(array(ref('Product'))),
});
add('get', '/api/products/lookup', 'lookupProduct', 'Products', 'Look up article variants', {
  description: member, parameters: [query('artNo')], schema: envelope({ type: 'object', nullable: true, properties: { product: ref('Product'), colours: array(string), materials: array(string), variants: array({ type: 'object' }) } }),
});
const productExample = { artNo: 'SW-001', name: 'Summer shoe', type: 'Tufli', seasons: ['Summer'], price: 200000, landingPrice: 150000, colour: 'Black', material: 'Leather', inventory: [{ size: '38', quantity: 2 }], boxQuantity: 0, images: [] };
add('post', '/api/products', 'createProduct', 'Products', 'Create a variant or add stock to a matching variant', {
  description: manager + ' A matching variant receives additional stock and updated prices (200); a new product or variant returns 201.',
  schema: envelope(ref('Product')), status: 201, requestBody: body(ref('ProductInput'), productExample),
});
paths['/api/products'].post.responses[200] = response(envelope(ref('Product')), 'Existing variant updated and inventory incremented');
add('get', '/api/products/{id}', 'getProduct', 'Products', 'Get a product in the active store', { description: member, parameters: [param()], schema: envelope(ref('Product')) });
add('put', '/api/products/{id}', 'updateProduct', 'Products', 'Update product details and images', {
  description: manager + ' Requires the full product payload. This operation updates details, seasons, and images; use price and inventory endpoints to change prices or stock. Omitted existing images are removed. variantId selects a variant; if omitted the most recently updated variant is selected.',
  parameters: [param()], schema: envelope(ref('Product')), requestBody: body(ref('ProductInput'), productExample),
});
add('delete', '/api/products/{id}', 'deleteProduct', 'Products', 'Delete product variants belonging to the active store', { description: manager, parameters: [param()], schema: envelope(object({ id })) });
add('post', '/api/products/prices', 'updatePrices', 'Products', 'Update prices for all variants of an article in the store', {
  description: manager + ' Supply at least one of landingPriceUpdate or sellingPrice.',
  requestBody: body(ref('PriceUpdate'), { artNo: 'SW-001', sellingPrice: 220000 }),
  schema: envelope(object({ artNo: string, updatedVariants: integer, lookup: { type: 'object' } })),
});
add('put', '/api/products/{id}/pair-inventory', 'replacePairInventory', 'Inventory', 'Replace loose-pair inventory', {
  description: manager + ' Replaces all loose-pair quantities for the selected variant. Omitted sizes are removed.', parameters: [param()], schema: envelope(ref('Product')),
  requestBody: body(object({ variantId: id, inventory: array(ref('InventoryRow')) }, ['inventory']), { variantId: 1, inventory: [{ size: '38', quantity: 4 }] }),
});
add('put', '/api/products/{id}/box-stock', 'replaceBoxStock', 'Inventory', 'Replace unopened box stock', {
  description: manager + ' Existing box IDs omitted from boxes are zeroed. Supply an id to update a box row; omit id to add one.', parameters: [param()], schema: envelope(ref('Product')),
  requestBody: body(object({ variantId: id, boxes: array(ref('Box')) }, ['boxes']), { variantId: 1, boxes: [{ sizeRange: '36,37x2,38', quantity: 2 }] }),
});
add('post', '/api/box-stock/{id}/open', 'openBox', 'Inventory', 'Open one box and transfer its contents into loose-pair stock', {
  description: manager, parameters: [param()], schema: envelope(object({ opened: { type: 'object' }, product: ref('Product') })),
});
add('post', '/api/stock-additions/{id}/cancel', 'cancelStockAddition', 'Inventory', 'Cancel a stock addition and remove its remaining stock', {
  description: manager, parameters: [param()], schema: envelope(object({ addition: ref('Cancellation'), product: ref('Product') })),
});
add('post', '/api/inventory/sold', 'recordSale', 'Sales', 'Record a pair or box sale', {
  description: member + ' Pair sales require size and sold_price. Box sales require pair_price and box_price (or sold_price). quantity counts pairs or boxes respectively. open_box_if_needed permits opening a box for a pair sale.',
  schema: ref('SaleResult'), requestBody: { required: true, content: { 'application/json': { schema: ref('SaleInput'), examples: {
    pair: { summary: 'Sell one loose pair', value: { sale_type: 'pair', art_no: 'SW-001', colour_name: 'Black', material_type: 'Leather', size: '38', sold_price: 200000, quantity: 1 } },
    box: { summary: 'Sell one unopened box', value: { sale_type: 'box', art_no: 'SW-001', colour_name: 'Black', material_type: 'Leather', box_stock_id: 1, pair_price: 200000, box_price: 800000, quantity: 1 } },
  } } } },
});
add('get', '/api/sold-products', 'listSales', 'Sales', 'List sales for a date', {
  description: member + ' Defaults to the database current date. Staff see only their own sales; landing costs require manager access.', parameters: [query('date', { type: 'string', format: 'date' }, 'YYYY-MM-DD')],
  schema: envelope(object({ date: { type: 'string', format: 'date' }, viewer: object({ canViewLandingPrice: { type: 'boolean' } }), items: array(object({ id: string, saleType: string, quantity: integer, soldPrice: money, isCancelled: { type: 'boolean' } })) })),
});
add('post', '/api/sold-products/{id}/cancel', 'cancelSale', 'Sales', 'Cancel a sale and restore inventory', {
  description: manager, parameters: [param('id', { type: 'string', pattern: '^(pair|box)-[0-9]+$', example: 'pair-1' })], schema: envelope(ref('Cancellation')),
});
add('post', '/api/uploads/temp', 'uploadTemporaryImage', 'Uploads', 'Upload an image as JSON with base64 data', {
  description: manager, status: 201, schema: envelope(object({ tempId: string, path: string })),
  requestBody: body(object({ image: ref('Image') }, ['image']), { image: { name: 'shoe.png', type: 'image/png', data: 'data:image/png;base64,REPLACE_WITH_IMAGE_DATA' } }),
});
add('delete', '/api/uploads/temp/{tempId}', 'deleteTemporaryImage', 'Uploads', 'Delete a temporary image', {
  description: manager, parameters: [param('tempId', string)], schema: envelope(object({ deleted: { type: 'boolean' } })),
});

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Admin Shoe Store API', version: '1.0.0',
    description: 'Swagger page access uses the credentials configured in .env. New users: execute POST /api/auth/signup to create your account and store and sign in. Existing users: execute POST /api/auth/login with your application account. Then try GET /api/auth/me. The browser sends the session cookie automatically on this same origin; do not paste cookies into Authorize. POST /api/auth/signout ends the API session. Inventory mutations affect the connected database.',
  },
  servers: [{ url: '/' }],
  tags: ['Authentication', 'System', 'Store', 'Products', 'Inventory', 'Sales', 'Uploads'].map(name => ({ name })),
  security: [{ sessionCookie: [] }],
  components: { schemas, securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'session', description: 'Set by POST /api/auth/login. Managed automatically by the browser; manual cookie entry is not supported by Swagger UI.' } } },
  paths,
};
