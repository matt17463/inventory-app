<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>Create Pull Sheet</title>

    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
        }

        input, select, button {
            padding: 10px;
            margin: 6px 0;
            width: 100%;
            font-size: 16px;
        }

        .item-row {
            padding: 10px;
            border-bottom: 1px solid #ccc;
            margin-bottom: 10px;
        }
    </style>
</head>

<body>

    <h2>Create Pull Sheet</h2>

    <label>Customer Name</label>
    <input id="customerName" type="text" />

    <label>Job Name</label>
    <input id="jobName" type="text" />

    <label>Due Date</label>
    <input id="dueDate" type="date" />

    <label>Notes</label>
    <input id="notes" type="text" />

    <hr />

    <h3>Add Items</h3>

    <label>Select Product</label>
    <select id="productSelect"></select>

    <label>Quantity</label>
    <input id="quantityInput" type="number" min="1" />

    <button onclick="addItem()">Add Item</button>

    <h3>Items Added</h3>
    <div id="itemsList"></div>

    <button onclick="savePullsheet()">Save Pull Sheet</button>

    <script src="pullsheet.js"></script>
</body>
</html>
