import { useEffect, useState } from "react";
import { auth, db, storage } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";

export default function ApplySeller() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [kycStatus, setKycStatus] = useState(null);

  const [form, setForm] = useState({
    businessName: "",
    phone: "",
    storeName: "",
    category: "",
    location: "",
    bankAccount: ""
  });

  const [files, setFiles] = useState({
    storePhotos: [],
    idDoc: null,
    cac: null,
    license: null
  });

  // 🔒 Check KYC before allowing access
  useEffect(() => {
    const checkUser = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return navigate("/");

      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.data();

      if (data?.kycStatus !== "Approved") {
        alert("You must verify your ID before becoming a seller.");
        navigate("/verify-id");
      } else {
        setKycStatus("Approved");
      }
    };

    checkUser();
  }, [navigate]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFile = (field, value) => {
    setFiles(prev => ({ ...prev, [field]: value }));
  };

  const uploadFile = async (file, path) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleSubmit = async () => {
    if (!form.businessName || !form.storeName || !form.phone) {
      alert("Please fill required fields");
      return;
    }

    setLoading(true);
    const uid = auth.currentUser.uid;
    const uploaded = {};

    try {
      // Upload store photos
      uploaded.storePhotos = [];
      for (const photo of files.storePhotos) {
        const url = await uploadFile(photo, `seller/${uid}/store_${Date.now()}`);
        uploaded.storePhotos.push(url);
      }

      if (files.idDoc) uploaded.idDoc = await uploadFile(files.idDoc, `seller/${uid}/idDoc`);
      if (files.cac) uploaded.cac = await uploadFile(files.cac, `seller/${uid}/cac`);
      if (files.license) uploaded.license = await uploadFile(files.license, `seller/${uid}/license`);

      await setDoc(doc(db, "sellerApplications", uid), {
        ...form,
        documents: uploaded,
        status: "Pending",
        submittedAt: serverTimestamp(),
        userId: uid
      });

      alert("Application submitted! Admin will review your request.");
      navigate("/profile");
    } catch (err) {
      console.error(err);
      alert("Submission failed. Try again.");
    }

    setLoading(false);
  };

  if (kycStatus !== "Approved") return null;

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh" }}>
      <TopNav />

      <div style={{
        maxWidth: 600,
        margin: "30px auto",
        background: "#fff",
        padding: 25,
        borderRadius: 16,
        boxShadow: "0 6px 25px rgba(0,0,0,0.08)"
      }}>
        <h2 style={{ textAlign: "center", marginBottom: 20 }}>Become a MiniMart Seller</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input placeholder="Business Name" value={form.businessName} onChange={e => handleChange("businessName", e.target.value)} />
          <input placeholder="Phone Number" value={form.phone} onChange={e => handleChange("phone", e.target.value)} />
          <input placeholder="Store Name" value={form.storeName} onChange={e => handleChange("storeName", e.target.value)} />

          <select value={form.category} onChange={e => handleChange("category", e.target.value)}>
            <option value="">Select Store Category</option>
            <option>Electronics</option>
            <option>Fashion</option>
            <option>Home & Kitchen</option>
            <option>Phones</option>
            <option>Other</option>
          </select>

          <input placeholder="Store Location" value={form.location} onChange={e => handleChange("location", e.target.value)} />
          <input placeholder="Bank Account (Optional)" value={form.bankAccount} onChange={e => handleChange("bankAccount", e.target.value)} />

          <label>Store Pictures
            <input type="file" multiple onChange={e => handleFile("storePhotos", Array.from(e.target.files))} />
          </label>

          <label>ID Document
            <input type="file" onChange={e => handleFile("idDoc", e.target.files[0])} />
          </label>

          <label>CAC Certificate (Optional)
            <input type="file" onChange={e => handleFile("cac", e.target.files[0])} />
          </label>

          <label>Business License (Optional)
            <input type="file" onChange={e => handleFile("license", e.target.files[0])} />
          </label>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 10,
              border: "none",
              background: "#4da6ff",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        </div>
      </div>
    </div>
  );
}