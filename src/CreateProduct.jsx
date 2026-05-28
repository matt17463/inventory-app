import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";

export default function CreateProduct() {
  const navigate = useNavigate();

  // Form state
  const [productName, setProductName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [productTypeId, setProductTypeId] = useState("");
  const [colorId, setColorId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [logoId, setLogoId] = useState("");
  const [imageFile, setImageFile] = useState(null);

  // Dropdown data
  const [customers, setCustomers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [logos, setLogos] = useState([]);

  // Load dropdown data
  useEffect(() => {
    const loadData = async () => {
      const tables = [
        { name: "customers", setter: setCustomers },
        { name: "brands", setter: setBrands },
        { name: "product_types", setter: setProductTypes },
        { name: "colors", setter: setColors },
        { name: "sizes", setter: setSizes },
        { name: "logos", setter: setLogos },
      ];

      for (const t of tables) {
        const { data, error } = await supabase
          .from(t.name)
          .select("*")
          .order("name");

        if (!error) {
          t.setter(data);
        } else {
          console.error(`Error loading ${t.name}:`, error);
        }
      }
    };

    loadData();
  }, []);

  // Safe conversion helper
  const safeNumber = (value) => {
    if (!value || value === "" || value === "null") return null;
    return Number(value);
  };

  // Image upload helper
  const uploadImage = async () => {
    if (!imageFile) return null;

    const fileName = `${Date.now()}-${imageFile.name}`;
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(fileName, imageFile);

    if (error) {
      console.error("Image upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const imageUrl = await uploadImage();

    const payload = {
      name: productName,
      customer_id: safeNumber(customerId),
      brand_id: safeNumber(brandId),
      product_type_id: safeNumber(productTypeId),
      color_id: safeNumber(colorId),
      size_id: safeNumber(sizeId),
      logo_id: safeNumber(logoId),
      image_url: imageUrl || null,
    };

    console.log("DEBUG payload:", payload);

    const { data, error } = await supabase.from("products").insert(payload).select();

    if (error) {
      console.error("Insert error:", error);
      alert("Error creating product: " + error.message);
      return;
    }

    const newProductId = data[0].id;
    navigate(`/assign-bin?product_id=${newProductId}`);
  };

  return (
    <div className="page">
      <h1>Create Product</h1>

      <form onSubmit={handleSubmit}>
        <label>Product Name</label>
        <input
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          required
        />

        <label>Customer</label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">None</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label>Brand</label>
        <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">None</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <label>Product Type</label>
        <select value={productTypeId} onChange={(e) => setProductTypeId(e.target.value)}>
          <option value="">None</option>
          {productTypes.map((pt) => (
            <option key={pt.id} value={pt.id}>{pt.name}</option>
          ))}
        </select>

        <label>Color</label>
        <select value={colorId} onChange={(e) => setColorId(e.target.value)}>
          <option value="">None</option>
          {colors.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label>Size</label>
        <select value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
          <option value="">None</option>
          {sizes.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <label>Logo</label>
        <select value={logoId} onChange={(e) => setLogoId(e.target.value)}>
          <option value="">None</option>
          {logos.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <label>Product Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
        />

        <button type="submit">Create Product</button>
      </form>
    </div>
  );
}
