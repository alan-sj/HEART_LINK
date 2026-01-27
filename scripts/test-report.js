import fetch from "node-fetch";

const test = async () => {
    const res = await fetch("http://localhost:3000/report/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            propertyId: "PROP_001",
            role: "Buyer"   // Buyer | Builder | Inspector
        })
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
};

test();
