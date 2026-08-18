// Initialize Supabase
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseKey = "YOUR_ANON_KEY";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let products = [];
let pullItems = [];

// Load products into dropdown
async function loadProducts() {
    const { data, error } = await supabase
        .from("products")
        .select("id, name, sku");

    if (error) {
        alert("Error loading products");
        console.error(error);
        return;
    }

    products = data;

    const select = document.getElementById("productSelect");
    select.innerHTML = "";

    data.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.sku})`;
        select.appendChild(opt);
    });
}

loadProducts();

// Add item to list
function addItem() {
    const productId = document.getElementById("productSelect").value;
    const qty = document.getElementById("quantityInput").value;

    if (!qty || qty <= 0) {
        alert("Enter a valid quantity");
        return;
    }

    pullItems.push({
        product_id: Number(productId),
        quantity: Number(qty)
    });

    renderItems();
}

// Show items on screen
function renderItems() {
    const container = document.getElementById("itemsList");
    container.innerHTML = "";

    pullItems.forEach((item, index) => {
        const product = products.find(p => p.id === item.product_id);

        const div = document.createElement("div");
        div.className = "item-row";
        div.textContent = `${product.name} — Qty: ${item.quantity}`;

        container.appendChild(div);
    });
}

// Save pull sheet to Supabase
async function savePullsheet() {
    const customerName = document.getElementById("customerName").value;
    const jobName = document.getElementById("jobName").value;
    const dueDate = document.getElementById("dueDate").value;
    const notes = document.getElementById("notes").value;

    if (!customerName || !jobName) {
        alert("Customer name and job name are required");
        return;
    }

    // Create job
    const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .insert({
            customer_name: customerName,
            job_name: jobName,
            due_date: dueDate,
            notes: notes
        })
        .select()
        .single();

    if (jobError) {
        alert("Error creating pull sheet");
        console.error(jobError);
        return;
    }

    const jobId = jobData.id;

    // Insert items
    for (const item of pullItems) {
        await supabase.from("job_items").insert({
            job_id: jobId,
            product_id: item.product_id,
            quantity: item.quantity
        });
    }

    alert("Pull sheet saved!");
}
