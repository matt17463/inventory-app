import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function CreateProduct() {
    // Lookup lists
    const [customers, setCustomers] = useState([]);
    const [brands, setBrands] = useState([]);
    const [productTypes, setProductTypes] = useState([]);
    const [colors, setColors] = useState([]);
    const [sizes, setSizes] = useState([]);
    const [logos, setLogos] = useState([]);

    // Selected values
    const [customerId, setCustomerId] = useState('');
    const [brandId, setBrandId] = useState('');
    const [productTypeId, setProductTypeId] = useState('');
    const [colorId, setColorId] = useState('');
    const [sizeId, setSizeId] = useState('');
    const [logoId, setLogoId] = useState('');

    // Product fields
    const [name, setName] = useState('');
    const [skuPreview, setSkuPreview] = useState('');

    // Image upload
    const [imageUrl, setImageUrl] = useState('');
    const navigate = useNavigate();

    // Load lookup tables
    useEffect(() => {
        async function loadLookups() {
            const [cust, br, pt, col, sz, lg] = await Promise.all([
                supabase.from('customers').select('*').order('name'),
                supabase.from('brands').select('*').order('name'),
                supabase.from('product_types').select('*').order('name'),
                supabase.from('colors').select('*').order('name'),
                supabase.from('sizes').select('*').order('name'),
                supabase.from('logos').select('*').order('name'),
            ]);

            setCustomers(cust.data || []);
            setBrands(br.data || []);
            setProductTypes(pt.data || []);
            setColors(col.data || []);
            setSizes(sz.data || []);
            setLogos(lg.data || []);
        }

        loadLookups();
    }, []);

    // Build SKU preview
    useEffect(() => {
        const customer = customers.find(x => x.id === Number(customerId));
        const productType = productTypes.find(x => x.id === Number(productTypeId));
        const color = colors.find(x => x.id === Number(colorId));
        const size = sizes.find(x => x.id === Number(sizeId));

        if (customer && productType && color && size) {
            setSkuPreview(
                `${customer.code}-${productType.code}-${color.code}-${size.code}`
            );
        } else {
            setSkuPreview('');
        }
    }, [customerId, productTypeId, colorId, sizeId, customers, productTypes, colors, sizes]);
    
console.log("DEBUG payload:", {
  customer_id: customerId ? Number(customerId) : null,
  // include other fields if needed
});

    // Image upload handler
    async function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = `${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, file);

        if (uploadError) {
            alert('Image upload failed: ' + uploadError.message);
            return;
        }

        const { data: publicUrlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);

        setImageUrl(publicUrlData.publicUrl);
    }

    // Save product
    async function handleSave(e) {
        e.preventDefault();

        const { error } = await supabase.from('products').insert({
            customer_id: Number(customerId),
            brand_id: Number(brandId),
            product_type_id: Number(productTypeId),
            color_id: Number(colorId),
            size_id: Number(sizeId),
            logo_id: Number(logoId),
            name,
            sku: skuPreview,
            image_url: imageUrl
        });

        if (error) {
            alert('Error: ' + error.message);
        } else {
            alert('Product created!');
            navigate('/select-product');
        }
    }

    return (
        <form onSubmit={handleSave} style={{ padding: "20px" }}>
            <h2>Create Product</h2>

            <label>
                Customer
                <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
                    <option value="">Select customer</option>
                    {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </label>

            <label>
                Brand
                <select value={brandId} onChange={e => setBrandId(e.target.value)}>
                    <option value="">Select brand</option>
                    {brands.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </label>

            <label>
                Product Type
                <select value={productTypeId} onChange={e => setProductTypeId(e.target.value)}>
                    <option value="">Select product type</option>
                    {productTypes.map(pt => (
                        <option key={pt.id} value={pt.id}>{pt.name}</option>
                    ))}
                </select>
            </label>

            <label>
                Color
                <select value={colorId} onChange={e => setColorId(e.target.value)}>
                    <option value="">Select color</option>
                    {colors.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </label>

            <label>
                Size
                <select value={sizeId} onChange={e => setSizeId(e.target.value)}>
                    <option value="">Select size</option>
                    {sizes.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </label>

            <label>
                Logo
                <select value={logoId} onChange={e => setLogoId(e.target.value)}>
                    <option value="">Select logo</option>
                    {logos.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                </select>
            </label>

            <label>
                Product Name
                <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Example: SKSC Hoodie Sport Grey YL"
                />
            </label>

            <p><strong>SKU Preview:</strong> {skuPreview || '(select options)'}</p>

            <label>
                Product Image
                <input type="file" accept="image/*" onChange={handleImageUpload} />
            </label>

            {imageUrl && (
                <img
                    src={imageUrl}
                    alt="Preview"
                    style={{ width: "150px", marginTop: "10px", borderRadius: "6px" }}
                />
            )}

            <button type="submit" style={{ marginTop: "20px" }}>
                Save Product
            </button>
        </form>
    );
}
