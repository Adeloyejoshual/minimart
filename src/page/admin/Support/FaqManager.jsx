// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/Support/FaqManager.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const BASE  = `${import.meta.env.VITE_API_BASE_URL}/api/admin/support`;
const token = () => localStorage.getItem("admin_token");
const auth  = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const Ic = {
  plus:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  eye:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  x:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

const BLANK = { category_id: "", title: "", content: "", slug: "", tags: "", is_published: true };

function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export default function FaqManager() {
  const [categories, setCategories] = useState([]);
  const [articles,   setArticles]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selCat,     setSelCat]     = useState("");
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(BLANK);
  const [saving,     setSaving]     = useState(false);

  const loadCats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BASE}/faq/categories`, auth());
      setCategories(data.categories ?? []);
    } catch (e) { console.warn("[FaqManager] cats:", e.message); }
  }, []);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: 100 });
      if (selCat) p.set("category_id", selCat);
      const { data } = await axios.get(`${BASE}/faq/articles?${p}`, auth());
      setArticles(data.articles ?? []);
    } catch (e) { console.warn("[FaqManager] articles:", e.message); }
    finally     { setLoading(false); }
  }, [selCat]);

  useEffect(() => { loadCats(); },     [loadCats]);
  useEffect(() => { loadArticles(); }, [loadArticles]);

  function openCreate() { setEditing(null); setForm(BLANK); setShowForm(true); }
  function openEdit(a)  {
    setEditing(a);
    setForm({
      category_id:  a.category_id ?? "",
      title:        a.title       ?? "",
      content:      a.content     ?? "",
      slug:         a.slug        ?? "",
      tags:         Array.isArray(a.tags) ? a.tags.join(", ") : "",
      is_published: a.is_published ?? true,
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
    try {
      if (editing) {
        await axios.patch(`${BASE}/faq/articles/${editing.id}`, payload, auth());
      } else {
        await axios.post(`${BASE}/faq/articles`, payload, auth());
      }
      setShowForm(false);
      loadArticles();
    } finally { setSaving(false); }
  }

  async function togglePublish(a) {
    await axios.patch(`${BASE}/faq/articles/${a.id}`, { is_published: !a.is_published }, auth());
    loadArticles();
  }

  async function del(a) {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    await axios.delete(`${BASE}/faq/articles/${a.id}`, auth());
    loadArticles();
  }

  return (
    <div className="sp-wrap">
      <div className="sp-header">
        <div><h1 className="sp-title">FAQ Manager</h1><p className="sp-sub">{articles.length} articles</p></div>
        <button className="sp-btn-solid sp-btn-sm" onClick={openCreate}>{Ic.plus} New Article</button>
      </div>

      {/* cat filter */}
      <div className="sp-filters">
        <select value={selCat} onChange={(e) => setSelCat(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.published_count ?? 0})</option>)}
        </select>
      </div>

      {/* form */}
      {showForm && (
        <div className="sp-faq-form">
          <div className="sp-faq-form-head">
            <h3 className="sp-panel-title">{editing ? "Edit Article" : "New Article"}</h3>
            <button className="sp-btn-ghost sp-btn-xs" onClick={() => setShowForm(false)}>{Ic.x} Cancel</button>
          </div>
          <form onSubmit={handleSubmit} className="sp-faq-fields">
            <div className="sp-faq-row">
              <div className="sp-faq-field">
                <label>Category *</label>
                <select required value={form.category_id} onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="sp-faq-field" style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                <label style={{ marginBottom: 0 }}>Published</label>
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
                  style={{ width: 16, height: 16 }}
                />
              </div>
            </div>

            <div className="sp-faq-field">
              <label>Title *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value, slug: p.slug || slugify(e.target.value) }))}
                placeholder="Article title"
              />
            </div>

            <div className="sp-faq-row">
              <div className="sp-faq-field">
                <label>Slug *</label>
                <input required value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="url-slug" />
              </div>
              <div className="sp-faq-field">
                <label>Tags (comma separated)</label>
                <input value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="account, login" />
              </div>
            </div>

            <div className="sp-faq-field">
              <label>Content (HTML) *</label>
              <textarea
                required
                rows={10}
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="<p>Article content…</p>"
                className="sp-faq-content"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="sp-btn-ghost sp-btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="sp-btn-solid sp-btn-sm" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Article"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* articles table */}
      {loading ? <div className="sp-loading">Loading articles…</div> : (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr><th>Title</th><th>Category</th><th>Views</th><th>Rating</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {articles.length === 0
                ? <tr><td colSpan={6} className="sp-empty">No articles found</td></tr>
                : articles.map((a) => (
                    <tr key={a.id}>
                      <td><p className="sp-name">{a.title}</p><p className="sp-email">{a.slug}</p></td>
                      <td><span className="sp-tag">{a.category_name}</span></td>
                      <td className="sp-date">{a.view_count ?? 0}</td>
                      <td className="sp-date">{a.helpful_count ?? 0} / {(a.helpful_count ?? 0) + (a.not_helpful_count ?? 0)}</td>
                      <td>
                        <span style={{ background: a.is_published ? "#DCFCE7" : "#F3F4F6", color: a.is_published ? "#15803D" : "#6B7280", padding: "2px 9px", borderRadius: 100, fontSize: 11, fontWeight: 700 }}>
                          {a.is_published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td>
                        <div className="sp-actions">
                          <button className="sp-btn-ghost sp-btn-xs" onClick={() => openEdit(a)}>{Ic.edit} Edit</button>
                          <button className="sp-btn-ghost sp-btn-xs" onClick={() => togglePublish(a)}>
                            {a.is_published ? <>{Ic.eyeOff} Unpublish</> : <>{Ic.eye} Publish</>}
                          </button>
                          <button className="sp-btn-danger sp-btn-xs" onClick={() => del(a)}>{Ic.trash}</button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}