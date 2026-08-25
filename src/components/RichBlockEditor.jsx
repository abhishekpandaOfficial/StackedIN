import { useRef, useState } from "react";
import {
  AlertCircle, CheckSquare, Code2, Copy, GripVertical, Heading2, ImagePlus, Link2,
  List, ListOrdered, MessageSquareQuote, Minus, Plus, Sparkles, Table2, Trash2, Type, Video,
} from "lucide-react";

const uid = () => crypto.randomUUID();

export const createContentBlock = (type = "paragraph") => ({
  id: uid(),
  type,
  ...(type === "code" ? { code: "", language: "typescript" }
    : type === "image" ? { url: "", alt: "", caption: "" }
      : type === "video" ? { url: "", caption: "" }
        : type === "button" ? { label: "Read more", url: "" }
          : type === "table" ? { rows: [["Column 1", "Column 2"], ["", ""]] }
            : ["bullet_list", "numbered_list", "checklist"].includes(type) ? { items: [{ id: uid(), text: "", checked: false }] }
              : type === "callout" ? { text: "", tone: "idea" }
                : type === "divider" ? {} : { text: "" }),
});

function SafeVideo({ block }) {
  if (!/^https:\/\//i.test(block.url || "")) return null;
  const directVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(block.url);
  return <figure className="native-video">
    {directVideo ? <video controls preload="metadata" src={block.url} /> : <a href={block.url} target="_blank" rel="noreferrer"><Video size={24} /><span>Open embedded media</span><small>{block.url}</small></a>}
    {block.caption && <figcaption>{block.caption}</figcaption>}
  </figure>;
}

export function ContentBlocks({ blocks = [] }) {
  return <div className="native-content-blocks">{blocks.map(block => {
    if (block.type === "heading") return <h2 key={block.id}>{block.text}</h2>;
    if (block.type === "subheading") return <h3 key={block.id}>{block.text}</h3>;
    if (block.type === "quote") return <blockquote key={block.id}>{block.text}</blockquote>;
    if (block.type === "callout") return <aside className={`native-callout ${block.tone || "idea"}`} key={block.id}><Sparkles size={18} /><p>{block.text}</p></aside>;
    if (block.type === "code") return <figure className="native-code" key={block.id}><figcaption>{block.language || "code"}</figcaption><pre><code>{block.code}</code></pre></figure>;
    if (block.type === "image") return <figure className="native-image" key={block.id}><img src={block.url} alt={block.alt || block.caption || "Article illustration"} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
    if (block.type === "video") return <SafeVideo block={block} key={block.id} />;
    if (block.type === "bullet_list") return <ul key={block.id}>{(block.items || []).map(item => <li key={item.id}>{item.text}</li>)}</ul>;
    if (block.type === "numbered_list") return <ol key={block.id}>{(block.items || []).map(item => <li key={item.id}>{item.text}</li>)}</ol>;
    if (block.type === "checklist") return <ul className="native-checklist" key={block.id}>{(block.items || []).map(item => <li key={item.id}><span aria-hidden="true">{item.checked ? "✓" : ""}</span>{item.text}</li>)}</ul>;
    if (block.type === "table") return <div className="native-table-wrap" key={block.id}><table><tbody>{(block.rows || []).map((row, rowIndex) => <tr key={`${block.id}-${rowIndex}`}>{row.map((cell, cellIndex) => rowIndex === 0 ? <th key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
    if (block.type === "button") return <p className="native-button-wrap" key={block.id}><a href={block.url} target="_blank" rel="noreferrer">{block.label}</a></p>;
    if (block.type === "divider") return <hr key={block.id} />;
    return <p key={block.id}>{block.text}</p>;
  })}</div>;
}

const tools = [
  { type: "paragraph", label: "Text", icon: Type },
  { type: "heading", label: "Heading", icon: Heading2 },
  { type: "bullet_list", label: "Bullets", icon: List },
  { type: "numbered_list", label: "Numbers", icon: ListOrdered },
  { type: "checklist", label: "Checklist", icon: CheckSquare },
  { type: "quote", label: "Quote", icon: MessageSquareQuote },
  { type: "callout", label: "Callout", icon: AlertCircle },
  { type: "code", label: "Code", icon: Code2 },
  { type: "table", label: "Table", icon: Table2 },
  { type: "video", label: "Media", icon: Video },
  { type: "button", label: "Button", icon: Link2 },
  { type: "divider", label: "Divider", icon: Minus },
];

function ListEditor({ block, update }) {
  const items = block.items || [];
  const patchItem = (id, patch) => update({ items: items.map(item => item.id === id ? { ...item, ...patch } : item) });
  const addItem = () => update({ items: [...items, { id: uid(), text: "", checked: false }] });
  const removeItem = id => update({ items: items.filter(item => item.id !== id) });
  return <div className="list-block-fields">{items.map((item, index) => <div key={item.id}>
    {block.type === "checklist" ? <input type="checkbox" checked={Boolean(item.checked)} onChange={event => patchItem(item.id, { checked: event.target.checked })} /> : <span>{block.type === "numbered_list" ? `${index + 1}.` : "•"}</span>}
    <input value={item.text} onChange={event => patchItem(item.id, { text: event.target.value })} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addItem(); } }} placeholder="List item" />
    {items.length > 1 && <button type="button" aria-label="Remove list item" onClick={() => removeItem(item.id)}>×</button>}
  </div>)}<button type="button" onClick={addItem}><Plus size={13} />Add item</button></div>;
}

function TableEditor({ block, update }) {
  const rows = block.rows || [["", ""]];
  const patchCell = (rowIndex, cellIndex, value) => update({ rows: rows.map((row, r) => row.map((cell, c) => r === rowIndex && c === cellIndex ? value : cell)) });
  const addRow = () => update({ rows: [...rows, Array.from({ length: rows[0]?.length || 2 }, () => "")] });
  const addColumn = () => update({ rows: rows.map(row => [...row, ""]) });
  return <div className="table-block-fields"><div className="table-grid" style={{ gridTemplateColumns: `repeat(${rows[0]?.length || 2}, minmax(120px, 1fr))` }}>{rows.map((row, rowIndex) => row.map((cell, cellIndex) => <input key={`${rowIndex}-${cellIndex}`} value={cell} onChange={event => patchCell(rowIndex, cellIndex, event.target.value)} placeholder={rowIndex === 0 ? "Header" : "Cell"} />))}</div><footer><button type="button" onClick={addRow}><Plus size={12} />Row</button><button type="button" onClick={addColumn}><Plus size={12} />Column</button></footer></div>;
}

export function RichBlockEditor({ blocks, onChange, onUploadImage }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragged, setDragged] = useState(null);
  const add = (type, index = blocks.length) => {
    const next = [...blocks];
    next.splice(index, 0, createContentBlock(type));
    onChange(next);
  };
  const update = (id, patch) => onChange(blocks.map(block => block.id === id ? { ...block, ...patch } : block));
  const remove = id => onChange(blocks.filter(block => block.id !== id));
  const duplicate = index => {
    const next = [...blocks];
    next.splice(index + 1, 0, { ...structuredClone(blocks[index]), id: uid() });
    onChange(next);
  };
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const drop = targetIndex => {
    if (dragged === null || dragged === targetIndex) return setDragged(null);
    const next = [...blocks];
    const [item] = next.splice(dragged, 1);
    next.splice(targetIndex, 0, item);
    onChange(next);
    setDragged(null);
  };
  const upload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await onUploadImage(file);
      onChange([...blocks, { ...createContentBlock("image"), url, caption: file.name }]);
    } catch (error) {
      setUploadError(error.message || "Image upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return <div className="rich-block-editor">
    <div className="editor-toolbar" aria-label="Content blocks">{tools.map(({ type, label, icon: Icon }) => <button type="button" key={type} onClick={() => add(type)} title={`Add ${label.toLowerCase()}`}><Icon size={15} /><span>{label}</span></button>)}<button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}><ImagePlus size={15} /><span>{uploading ? "Uploading…" : "Image"}</span></button><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={upload} /></div>
    <p className="editor-shortcut-hint"><Sparkles size={13} />Structured blocks keep every preview safe and portable—no raw HTML is stored.</p>
    {uploadError && <div className="native-inline-error">{uploadError}</div>}
    <div className="editor-block-list">{blocks.map((block, index) => <section className={`editor-block editor-block-${block.type} ${dragged === index ? "dragging" : ""}`} key={block.id} draggable onDragStart={() => setDragged(index)} onDragOver={event => event.preventDefault()} onDrop={() => drop(index)}>
      <div className="editor-block-handle"><GripVertical size={14} /><select aria-label="Block type" value={block.type} onChange={event => update(block.id, { ...createContentBlock(event.target.value), id: block.id })}>{tools.map(tool => <option value={tool.type} key={tool.type}>{tool.label}</option>)}</select><button type="button" onClick={() => move(index, -1)} aria-label="Move block up">↑</button><button type="button" onClick={() => move(index, 1)} aria-label="Move block down">↓</button><button type="button" onClick={() => duplicate(index)} aria-label="Duplicate block"><Copy size={12} /></button><button type="button" onClick={() => remove(block.id)} aria-label="Delete block"><Trash2 size={12} /></button></div>
      {block.type === "code" ? <><input className="code-language" value={block.language || ""} onChange={event => update(block.id, { language: event.target.value })} placeholder="Language" /><textarea className="code-input" value={block.code || ""} onChange={event => update(block.id, { code: event.target.value })} placeholder="Paste or write code…" spellCheck="false" /></>
        : block.type === "image" ? <div className="image-block-fields">{block.url ? <img src={block.url} alt="" /> : <ImagePlus size={24} />}<input value={block.url || ""} onChange={event => update(block.id, { url: event.target.value })} placeholder="Secure image URL" /><input value={block.alt || ""} onChange={event => update(block.id, { alt: event.target.value })} placeholder="Alternative text for accessibility" /><input value={block.caption || ""} onChange={event => update(block.id, { caption: event.target.value })} placeholder="Caption" /></div>
          : block.type === "video" ? <div className="media-block-fields"><Video size={24} /><input value={block.url || ""} onChange={event => update(block.id, { url: event.target.value })} placeholder="Secure MP4, WebM, or media URL" /><input value={block.caption || ""} onChange={event => update(block.id, { caption: event.target.value })} placeholder="Caption" /></div>
            : ["bullet_list", "numbered_list", "checklist"].includes(block.type) ? <ListEditor block={block} update={patch => update(block.id, patch)} />
              : block.type === "table" ? <TableEditor block={block} update={patch => update(block.id, patch)} />
                : block.type === "button" ? <div className="button-block-fields"><input value={block.label || ""} onChange={event => update(block.id, { label: event.target.value })} placeholder="Button label" /><input value={block.url || ""} onChange={event => update(block.id, { url: event.target.value })} placeholder="https://destination" /></div>
                  : block.type === "divider" ? <hr />
                    : <><textarea className={`text-input text-input-${block.type}`} value={block.text || ""} onChange={event => update(block.id, { text: event.target.value })} placeholder={block.type === "heading" ? "Section heading" : block.type === "subheading" ? "Subheading" : block.type === "quote" ? "A useful quotation" : block.type === "callout" ? "Highlight an important idea" : "Write something useful…"} />{block.type === "callout" && <select className="callout-tone" value={block.tone || "idea"} onChange={event => update(block.id, { tone: event.target.value })}><option value="idea">Idea</option><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option></select>}</>}
      <button type="button" className="insert-after" aria-label="Insert paragraph below" onClick={() => add("paragraph", index + 1)}><Plus size={12} /></button>
    </section>)}{!blocks.length && <button type="button" className="empty-editor" onClick={() => add("paragraph")}><Plus size={17} />Add your first content block</button>}</div>
  </div>;
}
