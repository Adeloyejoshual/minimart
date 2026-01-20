import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { db, auth, storage } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import categories from "../config/categories";
import phoneModels from "../config/phoneModels";
import conditions from "../config/condition";
import { promotionPlans } from "../config/promotionPlans";

const DRAFT_KEY = "add_product_draft";

export default function AddProduct({ navigation }) {
  const [form, setForm] = useState({
    mainCategory: "",
    subCategory: "",
    brand: "",
    model: "",
    condition: "",
    usedDetail: "",
    title: "",
    description: "",
    price: "",
    phone: "",
    images: [],
    previewUris: [],
    state: "",
    city: "",
    isPromoted: false,
    promotionPlan: promotionPlans[0].id,
  });

  const [loading, setLoading] = useState(false);
  const [selectionStep, setSelectionStep] = useState(null);

  // ---------- Draft Auto-Save ----------
  useEffect(() => {
    const loadDraft = async () => {
      const draft = await FileSystem.readAsStringAsync(FileSystem.documentDirectory + DRAFT_KEY).catch(() => null);
      if (draft) setForm(JSON.parse(draft));
    };
    loadDraft();
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      await FileSystem.writeAsStringAsync(FileSystem.documentDirectory + DRAFT_KEY, JSON.stringify(form)).catch(() => {});
    };
    saveDraft();
  }, [form]);

  // ---------- Pick Images ----------
  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.5, // compress
    });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setForm(prev => ({
        ...prev,
        images: [...prev.images, ...uris],
        previewUris: [...prev.previewUris, ...uris],
      }));
    }
  };

  const removeImage = idx => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
      previewUris: prev.previewUris.filter((_, i) => i !== idx),
    }));
  };

  // ---------- Validation ----------
  const validate = () => {
    if (!form.title) return "Enter title";
    if (!form.mainCategory) return "Select category";
    if (!form.price) return "Enter price";
    if (!form.phone || form.phone.length < 10) return "Enter valid phone";
    if (form.images.length === 0) return "Add at least 1 image";
    return null;
  };

  // ---------- Upload Offline / Queue ----------
  const handleAdd = async () => {
    const error = validate();
    if (error) return Alert.alert("Error", error);

    if (!auth.currentUser) return Alert.alert("Error", "Login required");

    try {
      setLoading(true);
      const uploadedUrls = [];

      // Upload images to Firebase Storage
      for (let i = 0; i < form.images.length; i++) {
        const imgUri = form.images[i];
        const blob = await (await fetch(imgUri)).blob();
        const ref = storage.ref().child(`products/${Date.now()}_${i}`);
        await ref.put(blob);
        uploadedUrls.push(await ref.getDownloadURL());
      }

      // Save to Firestore
      await addDoc(collection(db, "products"), {
        ...form,
        images: uploadedUrls,
        coverImage: uploadedUrls[0],
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", "Product added!");
      setForm({ images: [], previewUris: [], title: "", description: "", price: "", phone: "", mainCategory: "", subCategory: "", brand: "", model: "", condition: "", usedDetail: "", state: "", city: "", isPromoted: false, promotionPlan: promotionPlans[0].id });
      navigation.goBack();
    } catch (err) {
      Alert.alert("Upload Error", err.message);
      // Optional: save to offline queue
    } finally {
      setLoading(false);
    }
  };

  // ---------- Preview Screen ----------
  if (selectionStep === "preview") {
    return (
      <ScrollView style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 10 }}>Preview</Text>
        <Text>Title: {form.title}</Text>
        <Text>Category: {form.mainCategory} / {form.subCategory}</Text>
        <Text>Brand / Model: {form.brand} / {form.model}</Text>
        <Text>Condition: {form.condition} {form.usedDetail ? `(${form.usedDetail})` : ""}</Text>
        <Text>Price: {form.price}</Text>
        <Text>Phone: {form.phone}</Text>
        <ScrollView horizontal>
          {form.previewUris.map((uri, idx) => (
            <Image key={idx} source={{ uri }} style={{ width: 90, height: 90, marginRight: 6 }} />
          ))}
        </ScrollView>
        <TouchableOpacity style={{ marginTop: 20, padding: 12, backgroundColor: "#0D6EFD", borderRadius: 6 }} onPress={handleAdd}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>{loading ? "Uploading..." : "Publish"}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---------- Main Form ----------
  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 12 }}>Post Ad</Text>

      {/* Title */}
      <TextInput placeholder="Title" value={form.title} onChangeText={t => setForm(prev => ({ ...prev, title: t }))} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10, marginBottom: 12 }} />

      {/* Category */}
      <TouchableOpacity onPress={() => setSelectionStep("category")} style={{ padding: 12, borderWidth: 1, borderColor: "#cce0ff", borderRadius: 6, marginBottom: 12 }}>
        <Text>{form.mainCategory || "Select Category"}</Text>
      </TouchableOpacity>

      {/* Pick Images */}
      <TouchableOpacity onPress={pickImages} style={{ padding: 12, borderWidth: 1, borderColor: "#0D6EFD", borderRadius: 6, marginBottom: 12 }}>
        <Text>Add Images</Text>
      </TouchableOpacity>

      <ScrollView horizontal>
        {form.previewUris.map((uri, idx) => (
          <View key={idx} style={{ position: "relative", marginRight: 6 }}>
            <Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 6 }} />
            <TouchableOpacity onPress={() => removeImage(idx)} style={{ position: "absolute", top: -6, right: -6, backgroundColor: "red", width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff" }}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Price */}
      <TextInput placeholder="Price" keyboardType="numeric" value={form.price} onChangeText={t => setForm(prev => ({ ...prev, price: t }))} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10, marginBottom: 12 }} />

      {/* Phone */}
      <TextInput placeholder="Phone" keyboardType="phone-pad" value={form.phone} onChangeText={t => setForm(prev => ({ ...prev, phone: t }))} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10, marginBottom: 12 }} />

      {/* Preview Button */}
      <TouchableOpacity onPress={() => setSelectionStep("preview")} style={{ padding: 12, backgroundColor: "#0D6EFD", borderRadius: 6, marginTop: 16 }}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>Preview</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}