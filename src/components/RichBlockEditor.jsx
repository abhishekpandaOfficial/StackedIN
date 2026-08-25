import { useRef, useState } from "react";
import { Code2, Heading2, ImagePlus, ListPlus, MessageSquareQuote, Minus, Plus, Trash2, Type } from "lucide-react";

const createBlock = type => ({ id: crypto.randomUUID(), type, ...(type === "code" ? { code: "", language: "typescript" } : type === "image" ? { url: "", alt: "", caption: "" } : type === "divider" ? {} : { text: "" }) });

export function ContentBlocks({ blocks = [] }) {
  return <div className="native-content-blocks">{blocks.map(block => {
    if (block.type === "heading") return <h2 key={block.id}>{block.text}</h2>;
    if (block.type === "subheading") return <h3 key={block.id}>{block.text}</h3>;
    if (block.type === "quote") return <blockquote key={block.id}>{block.text}</blockquote>;
    if (block.type === "code") return <figure className="native-code" key={block.id}><figcaption>{block.language || "code"}</figcaption><pre><code>{block.code}</code></pre></figure>;
    if (block.type === "image") return <figure className="native-image" key={block.id}><img src={block.url} alt={block.alt || block.caption || "Article illustration"} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
    if (block.type === "divider") return <hr key={block.id} />;
    return <p key={block.id}>{block.text}</p>;
  })}</div>;
}

export function RichBlockEditor({ blocks, onChange, onUploadImage }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const add = type => onChange([...blocks, createBlock(type)]);
  const update = (id, patch) => onChange(blocks.map(block => block.id === id ? { ...block, ...patch } : block));
  const remove = id => onChange(blocks.filter(block => block.id !== id));
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks]; [next[index], next[target]] = [next[target], next[index]]; onChange(next);
  };
  const upload = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    setUploading(true); setUploadError("");
    try { const url = await onUploadImage(file); onChange([...blocks, { ...createBlock("image"), url, caption: file.name }]); }
    catch (error) { setUploadError(error.message || "Image upload failed."); }
    finally { setUploading(false); event.target.value = ""; }
  };
  const tools = [{ type: "paragraph", label: "Text", icon: Type }, { type: "heading", label: "Heading", icon: Heading2 }, { type: "quote", label: "Quote", icon: MessageSquareQuote }, { type: "code", label: "Code", icon: Code2 }, { type: "divider", label: "Divider", icon: Minus }];

  return <div className="rich-block-editor"><div className="editor-toolbar">{tools.map(({ type, label, icon: Icon }) => <button type="button" key={type} onClick={() => add(type)}><Icon size={15} />{label}</button>)}<button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}><ImagePlus size={15} />{uploading ? "Uploading…" : "Image"}</button><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={upload} /></div>{uploadError && <div className="native-inline-error">{uploadError}</div>}<div className="editor-block-list">{blocks.map((block, index) => <section className={`editor-block editor-block-${block.type}`} key={block.id}><div className="editor-block-handle"><button type="button" onClick={() => move(index, -1)} aria-label="Move block up">↑</button><button type="button" onClick={() => move(index, 1)} aria-label="Move block down">↓</button><button type="button" onClick={() => remove(block.id)} aria-label="Delete block"><Trash2 size={13} /></button></div>{block.type === "code" ? <><input className="code-language" value={block.language || ""} onChange={event => update(block.id, { language: event.target.value })} placeholder="Language" /><textarea className="code-input" value={block.code || ""} onChange={event => update(block.id, { code: event.target.value })} placeholder="Paste or write code…" /></> : block.type === "image" ? <div className="image-block-fields">{block.url ? <img src={block.url} alt="" /> : <ImagePlus size={24} />}<input value={block.url || ""} onChange={event => update(block.id, { url: event.target.value })} placeholder="Secure image URL" /><input value={block.caption || ""} onChange={event => update(block.id, { caption: event.target.value })} placeholder="Caption" /></div> : block.type === "divider" ? <hr /> : <textarea className={`text-input text-input-${block.type}`} value={block.text || ""} onChange={event => update(block.id, { text: event.target.value })} placeholder={block.type === "heading" ? "Section heading" : block.type === "quote" ? "A useful quotation" : "Write something useful…"} />}</section>)}{!blocks.length && <button type="button" className="empty-editor" onClick={() => add("paragraph")}><Plus size={17} />Add your first content block</button>}</div><button type="button" className="quick-add-block" onClick={() => add("paragraph")}><ListPlus size={14} />Add another block</button></div>;
}
