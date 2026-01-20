// AddProductExpo.js
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, TouchableOpacity, Image, ScrollView, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import NetInfo from "@react-native-community/netinfo";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import categories from "../config/categories";
import phoneModels from "../config/phoneModels";
import { locationsByState } from "../config/locationsByState";
import conditions from "../config/condition";
import { promotionPlans } from "../config/promotionPlans";
import { uploadToCloudinary } from "../cloudinary";

const DRAFT_KEY = "add_product_draft";
const MAX_IMAGES = 10;

export default function AddProductExpo({ navigation }) {
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
    state: "",
    city: "",
    isPromoted: false,
    promotionPlan: promotionPlans[0].id,
  });

  const [step, setStep] = useState("category");
  const [loading, setLoading] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState([]);

  // ---------------- Draft Auto-Save ----------------
  useEffect(() => {
    (async () => {
      const draft = await AsyncStorage.getItem(DRAFT_KEY);
      if (draft) setForm(JSON.parse(draft));
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  // ---------------- Helpers ----------------
  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const pickImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.cancelled) {
      let selected = result.selected ? result.selected : [result];
      if (selected.length + form.images.length > MAX_IMAGES) {
        return Alert.alert("Error", `Max ${MAX_IMAGES} images allowed`);
      }

      const compressed = await Promise.all(selected.map(async img => {
        const manip = await ImageManipulator.manipulateAsync(img.uri, [], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
        return manip.uri;
      }));

      setForm(prev => ({ ...prev, images: [...prev.images, ...compressed] }));
    }
  };

  const removeImage = idx => setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));

  const validate = () => {
    if (!form.title || !form.mainCategory || !form.subCategory || !form.price || !form.phone || !form.state || !form.city)
      return false;
    if (form.subCategory === "Mobile Phones") {
      if (!form.brand || !form.model || !form.condition) return false;
      if (form.condition === "Used" && !form.usedDetail) return false;
    }
    return true;
  };

  // ---------------- Submit / Offline Queue ----------------
  const handleSubmit = async () => {
    if (!auth.currentUser) return Alert.alert("Error", "Login required");
    if (!validate()) return Alert.alert("Error", "Please fill all required fields");

    const uploadAction = async () => {
      setLoading(true);
      try {
        const uploaded = await Promise.all(form.images.map(uri => uploadToCloudinary({ uri })));
        await addDoc(collection(db, "products"), {
          ...form,
          images: uploaded,
          coverImage: uploaded[0],
          ownerId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
        });
        await AsyncStorage.removeItem(DRAFT_KEY);
        Alert.alert("Success", "Product posted successfully");
        navigation.navigate("Marketplace");
      } catch (err) {
        Alert.alert("Offline", "Upload failed, queued offline");
        setOfflineQueue(prev => [...prev, form]);
      } finally {
        setLoading(false);
      }
    };

    const net = await NetInfo.fetch();
    if (net.isConnected) {
      await uploadAction();
    } else {
      setOfflineQueue(prev => [...prev, form]);
      Alert.alert("Offline", "No internet, product queued offline");
    }
  };

  // Auto-upload queued products when back online
  useEffect(() => {
    if (offlineQueue.length === 0) return;
    NetInfo.addEventListener(async state => {
      if (state.isConnected) {
        offlineQueue.forEach(async item => {
          try {
            const uploaded = await Promise.all(item.images.map(uri => uploadToCloudinary({ uri })));
            await addDoc(collection(db, "products"), {
              ...item,
              images: uploaded,
              coverImage: uploaded[0],
              ownerId: auth.currentUser.uid,
              createdAt: serverTimestamp(),
            });
            setOfflineQueue(prev => prev.filter(p => p !== item));
          } catch {}
        });
      }
    });
  }, [offlineQueue]);

  // ---------------- Derived Lists ----------------
  const subcategories = categories.find(c => c.name === form.mainCategory)?.subcategories || [];
  const brands = phoneModels[form.mainCategory] ? Object.keys(phoneModels[form.mainCategory]) : [];
  const models = form.brand ? phoneModels[form.mainCategory][form.brand] || [] : [];
  const states = Object.keys(locationsByState);
  const cities = form.state ? locationsByState[form.state] : [];

  // ---------------- Render ----------------
  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 12 }}>Step: {step}</Text>

      {/* Category Step */}
      {step === "category" && (
        <>
          <Text>Select Category</Text>
          {categories.map(c => (
            <TouchableOpacity key={c.name} onPress={() => updateForm("mainCategory", c.name)} style={{ padding: 12, borderWidth: 1, marginVertical: 4 }}>
              <Text style={{ fontWeight: form.mainCategory === c.name ? "bold" : "normal" }}>{c.name}</Text>
            </TouchableOpacity>
          ))}
          {form.mainCategory && <Button title="Next" onPress={() => setStep("details")} />}
        </>
      )}

      {/* Details Step */}
      {step === "details" && (
        <>
          <TextInput placeholder="Title" value={form.title} onChangeText={t => updateForm("title", t)} style={{ borderWidth: 1, padding: 8, marginVertical: 4 }} />
          <TextInput placeholder="Description" value={form.description} onChangeText={t => updateForm("description", t)} multiline style={{ borderWidth: 1, padding: 8, marginVertical: 4, height: 80 }} />

          {subcategories.length > 0 && (
            <Picker selectedValue={form.subCategory} onValueChange={val => updateForm("subCategory", val)}>
              <Picker.Item label="Select Subcategory" value="" />
              {subcategories.map(sc => <Picker.Item key={sc} label={sc} value={sc} />)}
            </Picker>
          )}

          {form.subCategory === "Mobile Phones" && (
            <>
              <Picker selectedValue={form.brand} onValueChange={val => updateForm("brand", val)}>
                <Picker.Item label="Select Brand" value="" />
                {brands.map(b => <Picker.Item key={b} label={b} value={b} />)}
              </Picker>
              <Picker selectedValue={form.model} onValueChange={val => updateForm("model", val)}>
                <Picker.Item label="Select Model" value="" />
                {models.map(m => <Picker.Item key={m} label={m} value={m} />)}
              </Picker>
              <Picker selectedValue={form.condition} onValueChange={val => updateForm("condition", val)}>
                <Picker.Item label="Select Condition" value="" />
                {conditions.main.map(c => <Picker.Item key={c} label={c} value={c} />)}
              </Picker>
              {form.condition === "Used" && (
                <Picker selectedValue={form.usedDetail} onValueChange={val => updateForm("usedDetail", val)}>
                  <Picker.Item label="Used Details" value="" />
                  {conditions.usedDetails.map(u => <Picker.Item key={u} label={u} value={u} />)}
                </Picker>
              )}
            </>
          )}
          <Button title="Next" onPress={() => setStep("images")} />
        </>
      )}

      {/* Images Step */}
      {step === "images" && (
        <>
          <Button title="Pick Images" onPress={pickImages} />
          <ScrollView horizontal style={{ marginVertical: 8 }}>
            {form.images.map((uri, i) => (
              <View key={i} style={{ position: "relative", marginRight: 8 }}>
                <Image source={{ uri }} style={{ width: 80, height: 80 }} />
                <TouchableOpacity onPress={() => removeImage(i)} style={{ position: "absolute", top: 0, right: 0 }}>
                  <Text style={{ fontSize: 20, color: "red" }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <Button title="Next" onPress={() => setStep("location")} />
        </>
      )}

      {/* Location Step */}
      {step === "location" && (
        <>
          <Picker selectedValue={form.state} onValueChange={val => updateForm("state", val)}>
            <Picker.Item label="Select State" value="" />
            {states.map(s => <Picker.Item key={s} label={s} value={s} />)}
          </Picker>
          {form.state && (
            <Picker selectedValue={form.city} onValueChange={val => updateForm("city", val)}>
              <Picker.Item label="Select City" value="" />
              {cities.map(c => <Picker.Item key={c} label={c} value={c} />)}
            </Picker>
          )}
          <Button title="Next" onPress={() => setStep("price")} />
        </>
      )}

      {/* Price & Promotion Step */}
      {step === "price" && (
        <>
          <TextInput placeholder="Price" value={form.price} onChangeText={t => updateForm("price", t)} keyboardType="numeric" style={{ borderWidth: 1, padding: 8, marginVertical: 4 }} />
          <TextInput placeholder="Phone" value={form.phone} onChangeText={t => updateForm("phone", t)} keyboardType="phone-pad" style={{ borderWidth: 1, padding: 8, marginVertical: 4 }} />
          <Text>Promotion Plans:</Text>
          {promotionPlans.map(p => (
            <TouchableOpacity key={p.id} onPress={() => updateForm("promotionPlan", p.id)} style={{ padding: 12, borderWidth: 1, marginVertical: 4 }}>
              <Text style={{ fontWeight: form.promotionPlan === p.id ? "bold" : "normal" }}>{p.label}</Text>
            </TouchableOpacity>
          ))}
          <Button title="Next" onPress={() => setStep("review")} />
        </>
      )}

      {/* Review Step */}
      {step === "review" && (
        <>
          <Text style={{ fontWeight: "bold", fontSize: 16 }}>Review & Publish</Text>
          <Text>Title: {form.title}</Text>
          <Text>Category: {form.mainCategory} / {form.subCategory}</Text>
          <Text>Brand/Model: {form.brand} / {form.model}</Text>
          <Text>Condition: {form.condition} {form.condition === "Used" && `(${form.usedDetail})`}</Text>
          <Text>Price: ₦{form.price}</Text>
          <Text>Phone: {form.phone}</Text>
          <Text>Location: {form.state} / {form.city}</Text>
          <Text>Promotion Plan: {promotionPlans.find(p => p.id === form.promotionPlan)?.label}</Text>
          <Text>Images: {form.images.length}</Text>
          <Button title={loading ? "Publishing..." : "Publish"} onPress={handleSubmit} disabled={loading} />
          <Button title="Back" onPress={() => setStep("price")} />
        </>
      )}

    </ScrollView>
  );
}