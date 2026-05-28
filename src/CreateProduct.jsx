import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
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
        const { data, error } = await supabase.from(t.name).select("*").order("name");
        if (!error
