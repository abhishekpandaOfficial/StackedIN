import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, CheckSquare, Code2, Copy, GripVertical, Heading2, Heading3, ImagePlus, Link2,
  List, ListOrdered, MessageSquareQuote, Minus, Plus, Sparkles, Table2, Trash2, Type, Upload, Video,
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

function RichInlineText({ text = "" }) {
  return String(text).split(/((?:^|\s)[@#][a-zA-Z0-9_.-]+)/g).filter(Boolean).map((part, index) => {
    const match = part.match(/^(\s*)([@#][a-zA-Z0-9_.-]+)$/);
    return match ? <span key={`${match[2]}-${index}`}>{match[1]}<b className="native-inline-token">{match[2]}</b></span> : part;
  });
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
    return <p key={block.id}><RichInlineText text={block.text} /></p>;
  })}</div>;
}

export const blockTools = [
  { type: "paragraph", label: "Text", shortcut: "/text", description: "Start writing with plain text", keywords: "paragraph body", icon: Type },
  { type: "heading", label: "Heading", shortcut: "/heading", description: "Create a large section heading", keywords: "h2 title", icon: Heading2 },
  { type: "subheading", label: "Subheading", shortcut: "/subheading", description: "Create a smaller section heading", keywords: "h3 subtitle", icon: Heading3 },
  { type: "bullet_list", label: "Bulleted list", shortcut: "/bullets", description: "Create a simple bulleted list", keywords: "unordered list", icon: List },
  { type: "numbered_list", label: "Numbered list", shortcut: "/numbers", description: "Create an ordered list", keywords: "ordered list", icon: ListOrdered },
  { type: "checklist", label: "To-do list", shortcut: "/todo", description: "Track items with checkboxes", keywords: "checklist task", icon: CheckSquare },
  { type: "quote", label: "Quote", shortcut: "/quote", description: "Capture a quotation or insight", keywords: "blockquote", icon: MessageSquareQuote },
  { type: "callout", label: "Callout", shortcut: "/callout", description: "Highlight something important", keywords: "notice info alert", icon: AlertCircle },
  { type: "code", label: "Code", shortcut: "/code", description: "Add syntax-friendly source code", keywords: "snippet programming", icon: Code2 },
  { type: "image", label: "Image", shortcut: "/image", description: "Upload or embed an image", keywords: "photo picture", icon: ImagePlus },
  { type: "table", label: "Table", shortcut: "/table", description: "Organize information in rows", keywords: "grid columns", icon: Table2 },
  { type: "video", label: "Media", shortcut: "/media", description: "Embed secure video or media", keywords: "video mp4 webm", icon: Video },
  { type: "button", label: "Button", shortcut: "/button", description: "Add a call-to-action link", keywords: "cta link", icon: Link2 },
  { type: "divider", label: "Divider", shortcut: "/divider", description: "Separate sections visually", keywords: "separator line", icon: Minus },
];

export const parseSlashCommand = value => {
  const match = String(value || "").match(/^\/([^/\n]*)$/);
  return match ? match[1].trimStart().toLowerCase() : null;
};

export const filterBlockTools = query => {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return blockTools;
  return blockTools.filter(tool => `${tool.label} ${tool.type} ${tool.shortcut} ${tool.keywords}`.toLowerCase().includes(normalized));
};

const textualTypes = ["paragraph", "heading", "subheading", "quote", "callout"];

function blockText(block) {
  if (textualTypes.includes(block.type)) return block.text || "";
  if (block.type === "code") return block.code || "";
  if (["bullet_list", "numbered_list", "checklist"].includes(block.type)) return (block.items || []).map(item => item.text).join("\n");
  return block.caption || block.label || "";
}

function convertBlock(block, type, clearContent = false) {
  const content = clearContent ? "" : blockText(block);
  const converted = { ...createContentBlock(type), id: block.id };
  if (textualTypes.includes(type)) converted.text = content;
  if (type === "code") converted.code = content;
  if (["bullet_list", "numbered_list", "checklist"].includes(type)) {
    const values = content.split("\n").filter(Boolean);
    converted.items = (values.length ? values : [""]).map(text => ({ id: uid(), text, checked: false }));
  }
  return converted;
}

function AutoTextarea({ value, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${Math.max(ref.current.scrollHeight, 38)}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} {...props} />;
}

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
  const editorRef = useRef(null);
  const uploadTarget = useRef(null);
  const pendingFocus = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragged, setDragged] = useState(null);
  const [commandMenu, setCommandMenu] = useState(null);
  const [activeCommand, setActiveCommand] = useState(0);
  const visibleTools = filterBlockTools(commandMenu?.query || "");

  useEffect(() => {
    if (!pendingFocus.current) return;
    const id = pendingFocus.current;
    pendingFocus.current = null;
    requestAnimationFrame(() => {
      const field = editorRef.current?.querySelector(`[data-block-id="${id}"] textarea, [data-block-id="${id}"] input`);
      field?.focus();
      if (typeof field?.setSelectionRange === "function") field.setSelectionRange(field.value.length, field.value.length);
    });
  }, [blocks]);

  useEffect(() => {
    const close = event => {
      if (commandMenu && !editorRef.current?.contains(event.target)) setCommandMenu(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [commandMenu]);

  const add = (type, index = blocks.length, patch = {}) => {
    const created = { ...createContentBlock(type), ...patch };
    const next = [...blocks];
    next.splice(index, 0, created);
    pendingFocus.current = created.id;
    onChange(next);
    return created;
  };
  const update = (id, patch) => onChange(blocks.map(block => block.id === id ? { ...block, ...patch } : block));
  const remove = (id, focusIndex = null) => {
    const next = blocks.filter(block => block.id !== id);
    if (!next.length) next.push(createContentBlock("paragraph"));
    if (focusIndex !== null) pendingFocus.current = next[Math.max(0, Math.min(focusIndex, next.length - 1))]?.id;
    onChange(next);
  };
  const duplicate = index => {
    const next = [...blocks];
    const copy = { ...structuredClone(blocks[index]), id: uid() };
    next.splice(index + 1, 0, copy);
    pendingFocus.current = copy.id;
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
  const openCommandMenu = (block, index, action = "insert", query = "") => {
    setCommandMenu({ blockId: block.id, index, action, query });
    setActiveCommand(0);
  };
  const selectCommand = type => {
    if (!commandMenu) return;
    const { index, action } = commandMenu;
    if (action === "replace") {
      const next = [...blocks];
      const block = next[index];
      const clearContent = parseSlashCommand(blockText(block)) !== null;
      next[index] = convertBlock(block, type, clearContent);
      pendingFocus.current = next[index].id;
      onChange(next);
    } else {
      add(type, index + 1);
    }
    setCommandMenu(null);
  };
  const handleTextChange = (block, index, value) => {
    update(block.id, { text: value });
    const query = parseSlashCommand(value);
    if (query !== null) openCommandMenu(block, index, "replace", query);
    else if (commandMenu?.blockId === block.id && commandMenu.action === "replace") setCommandMenu(null);
  };
  const handleTextKeyDown = (event, block, index) => {
    if (commandMenu?.blockId === block.id) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCommand(current => visibleTools.length ? (current + 1) % visibleTools.length : 0);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCommand(current => visibleTools.length ? (current - 1 + visibleTools.length) % visibleTools.length : 0);
        return;
      }
      if (event.key === "Enter" && visibleTools.length) {
        event.preventDefault();
        selectCommand(visibleTools[activeCommand]?.type || visibleTools[0].type);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setCommandMenu(null);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const start = event.currentTarget.selectionStart;
      const end = event.currentTarget.selectionEnd;
      const value = block.text || "";
      const next = [...blocks];
      next[index] = { ...block, text: value.slice(0, start) };
      const created = { ...createContentBlock("paragraph"), text: value.slice(end) };
      next.splice(index + 1, 0, created);
      pendingFocus.current = created.id;
      onChange(next);
      return;
    }
    if (event.key === "Backspace" && !(block.text || "") && blocks.length > 1) {
      event.preventDefault();
      setCommandMenu(null);
      remove(block.id, index - 1);
    }
  };
  const requestImageUpload = blockId => {
    uploadTarget.current = blockId;
    fileRef.current?.click();
  };
  const upload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await onUploadImage(file);
      const target = uploadTarget.current;
      if (target) onChange(blocks.map(block => block.id === target ? { ...block, url, caption: block.caption || file.name } : block));
      else add("image", blocks.length, { url, caption: file.name });
    } catch (error) {
      setUploadError(error.message || "Image upload failed.");
    } finally {
      setUploading(false);
      uploadTarget.current = null;
      event.target.value = "";
    }
  };

  return <div className="rich-block-editor notion-editor" ref={editorRef}>
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={upload} />
    {uploadError && <div className="native-inline-error">{uploadError}</div>}
    <div className="notion-editor-intro"><span><kbd>/</kbd> for commands</span><span><Plus size={12} /> to add any block</span><small>Enter creates a new block · Shift + Enter adds a line break</small></div>
    <div className="editor-block-list">{blocks.map((block, index) => {
      const currentTool = blockTools.find(tool => tool.type === block.type) || blockTools[0];
      const CurrentIcon = currentTool.icon;
      return <section data-block-id={block.id} className={`editor-block editor-block-${block.type} ${dragged === index ? "dragging" : ""} ${commandMenu?.blockId === block.id ? "command-open" : ""}`} key={block.id} onDragOver={event => event.preventDefault()} onDrop={() => drop(index)}>
      <div className="notion-block-controls">
        <button type="button" className="notion-add-block" aria-label="Add a block below" aria-expanded={commandMenu?.blockId === block.id && commandMenu.action === "insert"} onClick={() => openCommandMenu(block, index, "insert")}><Plus size={15} /></button>
        <button type="button" className="notion-drag-handle" draggable onDragStart={() => setDragged(index)} onDragEnd={() => setDragged(null)} aria-label="Drag to reorder block"><GripVertical size={15} /></button>
      </div>
      <div className="notion-block-actions">
        <button type="button" className="notion-type-button" onClick={() => openCommandMenu(block, index, "replace")} title="Change block type"><CurrentIcon size={12} />{currentTool.label}</button>
        <button type="button" onClick={() => move(index, -1)} aria-label="Move block up" disabled={index === 0}>↑</button>
        <button type="button" onClick={() => move(index, 1)} aria-label="Move block down" disabled={index === blocks.length - 1}>↓</button>
        <button type="button" onClick={() => duplicate(index)} aria-label="Duplicate block"><Copy size={12} /></button>
        <button type="button" onClick={() => remove(block.id, index - 1)} aria-label="Delete block"><Trash2 size={12} /></button>
      </div>
      {block.type === "code" ? <><input className="code-language" value={block.language || ""} onChange={event => update(block.id, { language: event.target.value })} placeholder="Language" /><textarea className="code-input" value={block.code || ""} onChange={event => update(block.id, { code: event.target.value })} placeholder="Paste or write code…" spellCheck="false" /></>
        : block.type === "image" ? <div className="image-block-fields">{block.url ? <img src={block.url} alt="" /> : <button type="button" className="notion-upload" onClick={() => requestImageUpload(block.id)} disabled={uploading}><Upload size={18} />{uploading && uploadTarget.current === block.id ? "Uploading…" : "Upload an image"}</button>}<input value={block.url || ""} onChange={event => update(block.id, { url: event.target.value })} placeholder="Or paste a secure image URL" /><input value={block.alt || ""} onChange={event => update(block.id, { alt: event.target.value })} placeholder="Alternative text for accessibility" /><input value={block.caption || ""} onChange={event => update(block.id, { caption: event.target.value })} placeholder="Caption" /></div>
          : block.type === "video" ? <div className="media-block-fields"><Video size={24} /><input value={block.url || ""} onChange={event => update(block.id, { url: event.target.value })} placeholder="Secure MP4, WebM, or media URL" /><input value={block.caption || ""} onChange={event => update(block.id, { caption: event.target.value })} placeholder="Caption" /></div>
            : ["bullet_list", "numbered_list", "checklist"].includes(block.type) ? <ListEditor block={block} update={patch => update(block.id, patch)} />
              : block.type === "table" ? <TableEditor block={block} update={patch => update(block.id, patch)} />
                : block.type === "button" ? <div className="button-block-fields"><input value={block.label || ""} onChange={event => update(block.id, { label: event.target.value })} placeholder="Button label" /><input value={block.url || ""} onChange={event => update(block.id, { url: event.target.value })} placeholder="https://destination" /></div>
                  : block.type === "divider" ? <hr />
                    : <><AutoTextarea className={`text-input text-input-${block.type}`} value={block.text || ""} onChange={event => handleTextChange(block, index, event.target.value)} onKeyDown={event => handleTextKeyDown(event, block, index)} onFocus={() => { if (commandMenu && commandMenu.blockId !== block.id) setCommandMenu(null); }} placeholder={block.type === "heading" ? "Section heading" : block.type === "subheading" ? "Subheading" : block.type === "quote" ? "A useful quotation" : block.type === "callout" ? "Highlight an important idea" : "Type '/' for commands"} />{block.type === "callout" && <select className="callout-tone" value={block.tone || "idea"} onChange={event => update(block.id, { tone: event.target.value })}><option value="idea">Idea</option><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option></select>}</>}
      {commandMenu?.blockId === block.id && <div className="notion-command-menu" role="listbox" aria-label="Insert a content block">
        <header><div><Sparkles size={14} /><span><strong>{commandMenu.action === "replace" ? "Turn into" : "Add a block"}</strong><small>{commandMenu.query ? `Results for “${commandMenu.query}”` : "Keep writing without leaving the keyboard"}</small></span></div><kbd>ESC</kbd></header>
        <div>{visibleTools.map((tool, toolIndex) => { const Icon = tool.icon; return <button type="button" role="option" aria-selected={toolIndex === activeCommand} className={toolIndex === activeCommand ? "active" : ""} key={tool.type} onMouseEnter={() => setActiveCommand(toolIndex)} onClick={() => selectCommand(tool.type)}><span><Icon size={17} /></span><div><strong>{tool.label}</strong><small>{tool.description}</small></div><kbd>{tool.shortcut}</kbd></button>; })}{!visibleTools.length && <p>No blocks match “{commandMenu.query}”. Press Escape to keep writing.</p>}</div>
      </div>}
    </section>;})}{!blocks.length && <button type="button" className="empty-editor" onClick={() => add("paragraph")}><Plus size={17} />Start writing</button>}</div>
  </div>;
}
