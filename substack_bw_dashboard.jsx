import { useState, useMemo, useRef, useEffect } from "react";
import { BarChart3, Beaker, BookOpen, Bot, Boxes, Brain, ChartNoAxesCombined, Check, ChevronDown, ChevronUp, Cloud, Code2, Copy, Database, ExternalLink, Eye, FlaskConical, GitBranch, Network, Pencil, Route, Server, Tag, Trash2 } from "lucide-react";
import { SiDocker, SiDotnet, SiGit, SiJupyter, SiKubernetes, SiMlflow, SiNumpy, SiPandas, SiPython, SiPytorch, SiTensorflow } from "@icons-pack/react-simple-icons";
const stackcraftLogo = `${import.meta.env.BASE_URL}stackcraft-logo.svg`;

const POSTS = [
  { id: 1, title: "Python for Machine Learning and Deep Learning", topic: "Python", tags: ["Python", "ML", "Deep Learning"], status: "Published", url: "https://pandaabhishek.substack.com/p/python-for-machine-learning-and-deep", views: 0, shares: 0, description: "Complete Python foundations for ML/DL practitioners." },
  { id: 2, title: "NumPy for Machine Learning and Deep Learning", topic: "NumPy", tags: ["NumPy", "ML", "Deep Learning"], status: "Published", url: "https://pandaabhishek.substack.com/p/numpy-for-machine-learning-and-deep", views: 0, shares: 0, description: "Vectorised operations and array manipulation for numerical computing." },
  { id: 3, title: "Pandas for Machine Learning and Deep Learning", topic: "Pandas", tags: ["Pandas", "ML", "Data"], status: "Published", url: "https://pandaabhishek.substack.com/p/pandas-for-machine-learning-and-deep", views: 0, shares: 0, description: "DataFrames, data wrangling, and preprocessing pipelines." },
  { id: 4, title: "Matplotlib for Machine Learning and Deep Learning", topic: "Matplotlib", tags: ["Matplotlib", "Visualisation", "ML"], status: "Published", url: "https://pandaabhishek.substack.com/p/matplotlib-for-machine-learning-and", views: 0, shares: 0, description: "Plotting fundamentals and custom visualisations for ML results." },
  { id: 5, title: "Seaborn for Statistical EDA", topic: "Seaborn", tags: ["Seaborn", "EDA", "Visualisation"], status: "Published", url: "https://pandaabhishek.substack.com/p/seaborn-for-statistical-eda", views: 0, shares: 0, description: "Statistical plots and exploratory data analysis with Seaborn." },
  { id: 6, title: "Day 1 — From Senior .NET Developer to AI Architect", topic: "100 Days ML", tags: ["Journey", "ML", ".NET"], status: "Published", url: "https://pandaabhishek.substack.com/p/from-senior-net-developer-to-ai-architect", views: 0, shares: 0, description: "Starting the 100-day ML journey — roadmap and mindset shift." },
  { id: 7, title: "Day 2 — 100 Days of Machine Learning", topic: "100 Days ML", tags: ["Journey", "ML"], status: "Published", url: "https://pandaabhishek.substack.com/p/100-days-of-machine-learning-and", views: 0, shares: 0, description: "Deep dive into core ML concepts and setting up the environment." },
  { id: 8, title: "Day 3 — 100 Days of Machine Learning", topic: "100 Days ML", tags: ["Journey", "ML"], status: "Published", url: "https://pandaabhishek.substack.com/p/100-days-of-machine-learning-and-51b", views: 0, shares: 0, description: "Datasets, feature types, and the data lifecycle in ML projects." },
  { id: 9, title: "Day 4 — 100 Days of Machine Learning", topic: "100 Days ML", tags: ["Journey", "ML"], status: "Published", url: "https://pandaabhishek.substack.com/p/100-days-of-machine-learning-and-65a", views: 0, shares: 0, description: "Hands-on data cleaning and dealing with missing values." },
  { id: 10, title: "Day 5 — 100 Days of Machine Learning", topic: "100 Days ML", tags: ["Journey", "ML"], status: "Published", url: "https://pandaabhishek.substack.com/p/100-days-of-machine-learning-and-484", views: 0, shares: 0, description: "Feature engineering techniques and model performance impact." },
  { id: 11, title: "ML-001: What Is Artificial Intelligence?", topic: "ML Series", tags: ["AI", "ML", "Fundamentals"], status: "Published", url: "https://pandaabhishek.substack.com/p/ml-001-what-is-artificial-intelligence", views: 0, shares: 0, description: "Defining AI, its scope, and why it matters for software engineers." },
  { id: 12, title: "ML-002: The Untold Story of Artificial Intelligence", topic: "ML Series", tags: ["AI", "History", "ML"], status: "Published", url: "https://pandaabhishek.substack.com/p/ml-002-the-untold-story-of-artificial", views: 0, shares: 0, description: "History of AI from Turing to transformers — breakthroughs and dead ends." },
  { id: 13, title: "ML-003: Understanding the Types of AI", topic: "ML Series", tags: ["AI", "ML", "Fundamentals"], status: "Published", url: "https://pandaabhishek.substack.com/p/ml-003-understanding-the-types-of", views: 0, shares: 0, description: "Narrow AI, General AI, and AGI — taxonomy and implications." },
  { id: 14, title: "ML-004: What Is Machine Learning?", topic: "ML Series", tags: ["ML", "Fundamentals"], status: "Published", url: "https://pandaabhishek.substack.com/p/ml-004-what-is-machine-learning", views: 0, shares: 0, description: "Formal definition of ML and the end-to-end ML workflow." },
  { id: 15, title: "ML-005: Machine Learning Fundamentals", topic: "ML Series", tags: ["ML", "Fundamentals"], status: "Published", url: "https://pandaabhishek.substack.com/p/ml-005-machine-learning-fundamentals", views: 0, shares: 0, description: "Bias-variance trade-off, overfitting, and underfitting explained." },
  { id: 16, title: "ML-006: Machine Learning Terminology", topic: "ML Series", tags: ["ML", "Fundamentals", "Glossary"], status: "Published", url: "https://pandaabhishek.substack.com/p/ml-006-machine-learning-terminology", views: 0, shares: 0, description: "Essential ML vocabulary every practitioner must know." },
  { id: 17, title: "ML-007: The Complete Machine Learning Roadmap", topic: "ML Series", tags: ["ML", "Roadmap"], status: "Published", url: "https://pandaabhishek.substack.com/p/ml-007-the-complete-machine-learning", views: 0, shares: 0, description: "Step-by-step learning path from zero to production ML engineer." },
  { id: 18, title: "ML-008: Exploratory Data Analysis", topic: "ML Series", tags: ["EDA", "ML", "Data"], status: "Published", url: "https://pandaabhishek.substack.com/p/day-12-ml-008-exploratory-data-analysis", views: 0, shares: 0, description: "Systematic EDA workflow — distributions, correlation, and hypothesis testing." },
  { id: 19, title: "Kubernetes Mastery — Part 1: From Containers to Clusters", topic: "Kubernetes", tags: ["Kubernetes", "DevOps", "Containers"], status: "Published", url: "https://pandaabhishek.substack.com/p/kubernetes-mastery-from-containers", views: 0, shares: 0, description: "Pods, nodes, clusters — Kubernetes architecture from scratch." },
  { id: 20, title: "Kubernetes Mastery — Part 2: Workloads and Configuration", topic: "Kubernetes", tags: ["Kubernetes", "DevOps"], status: "Published", url: "https://pandaabhishek.substack.com/p/kubernetes-mastery-workloads-configuration", views: 0, shares: 0, description: "Deployments, ConfigMaps, Secrets, and production workload management." },
  { id: 21, title: "RAG Is the Future of AI Apps", topic: "RAG", tags: ["RAG", "AI", "LLM"], status: "Published", url: "https://pandaabhishek.substack.com/p/rag-is-the-future-of-ai-apps-heres", views: 0, shares: 0, description: "Retrieval-Augmented Generation — architecture, benefits, and implementation." },
  { id: 22, title: "Vector RAG vs Vectorless RAG", topic: "RAG", tags: ["RAG", "AI", "LLM", "Vectors"], status: "Published", url: "https://pandaabhishek.substack.com/p/vector-rag-vs-vectorless-rag", views: 0, shares: 0, description: "Vector stores vs keyword retrieval — when to use which for RAG." },
  { id: 23, title: "Multithreading in .NET Core", topic: ".NET", tags: [".NET", "Concurrency", "Backend"], status: "Published", url: "https://pandaabhishek.substack.com/p/multithreading-in-net-core-building", views: 0, shares: 0, description: "High-performance concurrent apps with async/await, Threads, and Tasks." },
  { id: 24, title: "Queues vs Topics in Azure Service Bus", topic: "Azure", tags: ["Azure", "Messaging", "Cloud"], status: "Published", url: "https://pandaabhishek.substack.com/p/queues-vs-topics-in-messaging-frameworks", views: 0, shares: 0, description: "Messaging patterns and routing strategies in Azure Service Bus." },
  { id: 25, title: "Building a Production-Ready Azure Service Bus Topic", topic: "Azure", tags: ["Azure", "Messaging", "Cloud"], status: "Published", url: "https://pandaabhishek.substack.com/p/building-a-production-ready-azure", views: 0, shares: 0, description: "Topic subscriptions, filters, and dead-letter queue implementation." },
  { id: 26, title: "System Design Mastery — Complete Syllabus", topic: "System Design", tags: ["System Design", "Architecture"], status: "Published", url: "https://pandaabhishek.substack.com/p/the-complete-system-design-mastery", views: 0, shares: 0, description: "The definitive SD roadmap from CAP theorem to distributed caching." },
  { id: 27, title: "SD-001: What Is System Design?", topic: "System Design", tags: ["System Design", "Architecture", "Fundamentals"], status: "Published", url: "https://pandaabhishek.substack.com/p/sd-001-what-is-system-design", views: 0, shares: 0, description: "First principles of system design — requirements, constraints, process." },
  { id: 28, title: "From Foundations to Production ML", topic: "ML Series", tags: ["ML", "MLOps", "Production"], status: "Published", url: "https://pandaabhishek.substack.com/p/from-foundations-to-production-ml", views: 0, shares: 0, description: "Bridging notebook experiments and production-grade ML systems." },
  { id: 29, title: "ML-009: Logistic Regression", topic: "ML Algorithms", tags: ["ML", "Classification", "Algorithms"], status: "Published", url: "https://pandaabhishek.substack.com/p/ml-009-logistic-regression", views: 0, shares: 0, description: "Sigmoid, cost function, gradient descent, and model evaluation." },
  { id: 30, title: "ML-010: K-Nearest Neighbors (KNN)", topic: "ML Algorithms", tags: ["ML", "Classification", "Algorithms"], status: "Published", url: "https://pandaabhishek.substack.com/p/k-nearest-neighbors-knn-ml-010", views: 0, shares: 0, description: "KNN intuition, distance metrics, and choosing the right K." },
  { id: 31, title: "Decision Tree Classification", topic: "ML Algorithms", tags: ["ML", "Classification", "Algorithms", "Trees"], status: "Published", url: "https://pandaabhishek.substack.com/p/decision-tree-classification", views: 0, shares: 0, description: "Gini impurity, information gain, pruning, and practical implementation." },
  { id: 32, title: "MLOps — Part 1: Enterprise ML Operations", topic: "MLOps", tags: ["MLOps", "Production", "DevOps"], status: "Published", url: "https://pandaabhishek.substack.com/p/enterprise-mlops-and-ai-operations", views: 0, shares: 0, description: "MLOps principles, maturity model, and enterprise AI architecture." },
  { id: 33, title: "MLOps Phase 1: Credit Card Fraud Detection", topic: "MLOps", tags: ["MLOps", "Production", "Project"], status: "Published", url: "https://pandaabhishek.substack.com/p/phase-01-enterprise-credit-card-fraud", views: 0, shares: 0, description: "Data pipeline and feature engineering for fraud detection." },
  { id: 34, title: "MLOps Phase 2: Reproducible ML Engineering", topic: "MLOps", tags: ["MLOps", "Production", "Project"], status: "Published", url: "https://pandaabhishek.substack.com/p/phase-2-reproducible-ml-engineering", views: 0, shares: 0, description: "Reproducible experiments with versioning, environments, and DVC." },
  { id: 35, title: "MLOps Phase 3: MLflow Experiment Tracking", topic: "MLOps", tags: ["MLOps", "MLflow", "Tracking"], status: "Published", url: "https://pandaabhishek.substack.com/p/mlflow-experiment-tracking-model", views: 0, shares: 0, description: "Tracking experiments, comparing runs, and model registry with MLflow." },
  { id: 36, title: "MLOps Phase 4: Production Model Serving", topic: "MLOps", tags: ["MLOps", "Production", "Serving"], status: "Published", url: "https://pandaabhishek.substack.com/p/production-model-serving-phase-4", views: 0, shares: 0, description: "Deploying models as REST APIs, Docker containers, and monitoring." },
  { id: 37, title: "Random Forest Classifier", topic: "ML Algorithms", tags: ["ML", "Classification", "Ensemble", "Trees"], status: "Published", url: "https://pandaabhishek.substack.com/p/random-forest-classifier", views: 0, shares: 0, description: "Ensemble learning with bagging, feature randomness, and forest tuning." },
  { id: 38, title: "XGBoost Classification — Bank Marketing", topic: "ML Algorithms", tags: ["ML", "Classification", "XGBoost", "Ensemble"], status: "Published", url: "https://pandaabhishek.substack.com/p/xgboost-classification-bank-marketing", views: 0, shares: 0, description: "XGBoost from theory to practice on a real bank marketing dataset." },
  { id: 39, title: "Deep Learning Mastery — From Neural Networks to Production", topic: "Deep Learning", tags: ["Deep Learning", "Neural Networks", "AI"], status: "Published", url: "https://pandaabhishek.substack.com/p/deep-learning-mastery-from-neural", views: 0, shares: 0, description: "Part 1 — perceptrons, activation functions, backpropagation." },
];

const ALL_TOPICS = [...new Set(POSTS.map(p => p.topic))].sort();
const ALL_TAGS = [...new Set(POSTS.flatMap(p => p.tags))].sort();
const STATUSES = ["Published", "Draft", "Archived"];

const s = {
  page: { fontFamily: "'Inter', system-ui, sans-serif", background: "#fff", minHeight: "100vh", color: "#111" },
  header: { borderBottom: "1.5px solid #111", padding: "20px 32px 0" },
  headerTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  brandMark: { width: 32, height: 32, border: "2px solid #111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, letterSpacing: -1 },
  brandName: { fontSize: 18, fontWeight: 800, letterSpacing: -0.5 },
  brandSub: { fontSize: 11, color: "#666", marginTop: 1 },
  statStrip: { display: "flex", gap: 0, marginBottom: 0 },
  statBox: { padding: "10px 24px", borderRight: "1px solid #e0e0e0", minWidth: 100 },
  statNum: { fontSize: 22, fontWeight: 800, color: "#111", lineHeight: 1 },
  statLabel: { fontSize: 10, color: "#999", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 },
  tabs: { display: "flex", gap: 0, marginTop: 0 },
  tab: (active) => ({ padding: "10px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "none", border: "none", borderBottom: active ? "2px solid #111" : "2px solid transparent", color: active ? "#111" : "#888", letterSpacing: 0.3 }),
  body: { padding: "24px 32px" },
  toolbar: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" },
  input: { border: "1px solid #ddd", borderRadius: 4, padding: "6px 10px", fontSize: 12, color: "#111", background: "#fff", outline: "none", minWidth: 130 },
  btnPrimary: { background: "#111", color: "#fff", border: "none", borderRadius: 4, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3 },
  btnGhost: { background: "#fff", color: "#111", border: "1px solid #ddd", borderRadius: 4, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  btnDanger: { background: "#fff", color: "#c00", border: "1px solid #f0c0c0", borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" },
  btnEdit: { background: "#f5f5f5", color: "#333", border: "1px solid #e0e0e0", borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" },
  count: { fontSize: 11, color: "#999", alignSelf: "center" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1.5px solid #111", cursor: "pointer", whiteSpace: "nowrap" },
  td: { padding: "9px 12px", borderBottom: "1px solid #f0f0f0", verticalAlign: "top" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { background: "#fff", border: "1.5px solid #111", borderRadius: 6, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" },
  modalTitle: { fontSize: 15, fontWeight: 800, color: "#111", marginBottom: 20, letterSpacing: -0.3 },
  formField: { marginBottom: 14 },
  label: { display: "block", fontSize: 10, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  fullInput: { border: "1px solid #ccc", borderRadius: 4, padding: "7px 10px", fontSize: 12, color: "#111", background: "#fff", width: "100%", outline: "none" },
  toast: { position: "fixed", bottom: 24, right: 24, zIndex: 200, background: "#111", color: "#fff", borderRadius: 4, padding: "10px 18px", fontSize: 12, fontWeight: 600, letterSpacing: 0.2 },
  logPanel: { background: "#111", color: "#d8d8d8", borderRadius: 4, padding: "12px 14px", fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 11, lineHeight: 1.7, maxHeight: 180, overflowY: "auto" },
  launchPanel: { border: "1px solid #dfe3f5", borderRadius: 6, padding: "12px 14px", background: "linear-gradient(135deg, #fafbff, #f1f3ff)", maxWidth: 330 },
};

const StatusBadge = ({ status }) => {
  const map = { Published: { bg: "#111", color: "#fff" }, Draft: { bg: "#f5f5f5", color: "#555" }, Archived: { bg: "#f5f5f5", color: "#aaa" } };
  const st = map[status] || map.Archived;
  return <span style={{ background: st.bg, color: st.color, borderRadius: 3, padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{status}</span>;
};

const TAG_ICONS = {
  AI: Bot, Algorithms: Brain, Architecture: Network, Azure: Cloud, Backend: Server, Classification: BarChart3, Cloud,
  Containers: SiDocker, Data: Database, "Deep Learning": Brain, DevOps: SiGit, EDA: ChartNoAxesCombined, Ensemble: Boxes, Fundamentals: BookOpen,
  Glossary: BookOpen, Journey: Route, Kubernetes: SiKubernetes, LLM: Bot, ML: Brain, MLflow: SiMlflow, MLOps: Server,
  Messaging: Network, NumPy: SiNumpy, Pandas: SiPandas, Production: Server, Project: FlaskConical, Python: SiPython, RAG: Network,
  Roadmap: Route, Seaborn: ChartNoAxesCombined, Tracking: Eye, Trees: GitBranch, Vectors: Network, Visualisation: BarChart3,
  ".NET": SiDotnet, Jupyter: SiJupyter, Git: SiGit, Docker: SiDocker, PyTorch: SiPytorch, TensorFlow: SiTensorflow,
};

const TopicIcon = ({ topic }) => {
  const Icon = TAG_ICONS[topic] || Tag;
  return <span title={topic} aria-label={topic} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#555" }}><Icon size={15} strokeWidth={2} aria-hidden="true" /></span>;
};

const TagPill = ({ tag }) => {
  const Icon = TAG_ICONS[tag] || Tag;
  return <span title={tag} aria-label={tag} style={{ border: "1px solid #ddd", borderRadius: 3, width: 26, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#555", background: "#fafafa" }}><Icon size={13} strokeWidth={2} aria-hidden="true" /></span>;
};

export default function Dashboard() {
  const [posts, setPosts] = useState(POSTS);
  const [tab, setTab] = useState("posts");
  const [search, setSearch] = useState("");
  const [fTopic, setFTopic] = useState("");
  const [fTag, setFTag] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [sortCol, setSortCol] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  const [expandedTopics, setExpandedTopics] = useState(() => new Set(ALL_TOPICS));
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [importState, setImportState] = useState(null);
  const [visitCount, setVisitCount] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const csvRef = useRef();

  useEffect(() => {
    try {
      const visits = Number(localStorage.getItem("stackcraft-visits") || 0) + 1;
      const clicks = Number(localStorage.getItem("stackcraft-clicks") || 0);
      localStorage.setItem("stackcraft-visits", String(visits));
      setVisitCount(visits);
      setClickCount(clicks);
    } catch (error) {}
  }, []);

  const trackClick = () => {
    try {
      const clicks = Number(localStorage.getItem("stackcraft-clicks") || 0) + 1;
      localStorage.setItem("stackcraft-clicks", String(clicks));
      setClickCount(clicks);
    } catch (error) {}
  };

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const nextId = useMemo(() => Math.max(0, ...posts.map(p => p.id)) + 1, [posts]);

  const filtered = useMemo(() => {
    let out = posts.filter(p => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (fTopic && p.topic !== fTopic) return false;
      if (fTag && !p.tags.includes(fTag)) return false;
      if (fStatus && p.status !== fStatus) return false;
      return true;
    });
    return [...out].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });
  }, [posts, search, fTopic, fTag, fStatus, sortCol, sortDir]);

  const groupedPosts = useMemo(() => {
    const groups = new Map();
    filtered.forEach(post => groups.set(post.topic, [...(groups.get(post.topic) || []), post]));
    return [...groups.entries()];
  }, [filtered]);

  const toggleTopic = (topic) => {
    setExpandedTopics(current => {
      const next = new Set(current);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const stats = useMemo(() => {
    const totalViews = posts.reduce((s, p) => s + p.views, 0);
    const totalShares = posts.reduce((s, p) => s + p.shares, 0);
    const published = posts.filter(p => p.status === "Published").length;
    const byTopic = {};
    posts.forEach(p => { byTopic[p.topic] = (byTopic[p.topic] || 0) + p.views; });
    const topTopics = Object.entries(byTopic).sort((a, b) => b[1] - a[1]);
    const topPosts = [...posts].sort((a, b) => b.views - a.views).slice(0, 8);
    const byTag = {};
    posts.forEach(p => p.tags.forEach(t => { byTag[t] = (byTag[t] || 0) + p.views; }));
    const topTags = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { totalViews, totalShares, published, topTopics, topPosts, topTags };
  }, [posts]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };
  const Arr = ({ col }) => <span style={{ opacity: sortCol === col ? 1 : 0.25, fontSize: 9, marginLeft: 3 }}>{sortCol === col && sortDir === "desc" ? "▼" : "▲"}</span>;

  const openAdd = () => { setForm({ title: "", topic: "", tags: "", status: "Draft", url: "", views: 0, shares: 0, linkedinPublished: false, description: "" }); setEditId(null); setModal(true); };
  const openEdit = (p) => { setForm({ ...p, tags: p.tags.join(", ") }); setEditId(p.id); setModal(true); };
  const save = () => {
    if (!form.title?.trim() || !form.url?.trim()) { notify("Title and URL required."); return; }
    const tags = (form.tags || "").split(",").map(t => t.trim()).filter(Boolean);
    const post = { ...form, id: editId || nextId, tags, views: Number(form.views) || 0, shares: Number(form.shares) || 0 };
    if (editId) { setPosts(ps => ps.map(p => p.id === editId ? post : p)); notify("Post updated."); }
    else { setPosts(ps => [...ps, post]); notify("Post added."); }
    setModal(false);
  };
  const del = (id) => { if (!confirm("Delete this post?")) return; setPosts(ps => ps.filter(p => p.id !== id)); notify("Deleted."); };

  const copyLink = (p) => { navigator.clipboard.writeText(p.url); setCopiedId(p.id); setTimeout(() => setCopiedId(null), 1800); notify("Link copied."); };

  const parseCSV = (text) => {
    const source = text.replace(/^\uFEFF/, "");
    if (!source.trim()) return [];
    const firstLine = source.split(/\r?\n/, 1)[0];
    const delimiters = [",", ";", "\t"];
    const delimiter = delimiters.reduce((best, candidate) => {
      const count = firstLine.split(candidate).length - 1;
      return count > best.count ? { value: candidate, count } : best;
    }, { value: ",", count: -1 }).value;
    const rows = []; let row = []; let value = ""; let quoted = false;
    for (let i = 0; i < source.length; i++) {
      const character = source[i];
      if (character === '"' && source[i + 1] === '"' && quoted) { value += '"'; i++; }
      else if (character === '"') quoted = !quoted;
      else if (character === delimiter && !quoted) { row.push(value.trim()); value = ""; }
      else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && source[i + 1] === "\n") i++;
        row.push(value.trim());
        if (row.some(cell => cell)) rows.push(row);
        row = []; value = "";
      } else value += character;
    }
    row.push(value.trim());
    if (row.some(cell => cell)) rows.push(row);
    return rows;
  };

  const importCSV = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImportState({ progress: 8, logs: [`Opening ${file.name}...`], fileName: file.name });
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = parseCSV(event.target.result || "");
      if (!rows.length || !rows[0].length) {
        setImportState({ progress: 100, logs: [`Read ${file.name}`, "The file is empty. Add a header row and at least one data row, then try again."], fileName: file.name, matched: 0, skipped: 0, error: true });
        return;
      }
      const headerAliases = { article_title: "title", post_title: "title", headline: "title", total_views: "views", view_count: "views", total_shares: "shares", share_count: "shares" };
      const headers = rows[0].map(header => {
        const normalized = header.toLowerCase().replace(/\s+/g, "_").trim();
        return headerAliases[normalized] || normalized;
      });
      if (!headers.includes("title")) {
        setImportState({ progress: 100, logs: [`Read ${file.name}`, `Detected columns: ${headers.join(", ")}`, "Import stopped: a title column is required to match articles."], fileName: file.name, matched: 0, skipped: rows.length - 1, error: true });
        return;
      }
      const records = rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
      const logs = [`Reading ${file.name}`, `Detected ${headers.length} columns: ${headers.join(", ")}`, `Found ${records.length} data rows`];
      let matched = 0;
      const updated = posts.map(post => {
        const row = records.find(record => record.title && post.title.toLowerCase().includes(record.title.toLowerCase()));
        if (!row) return post;
        matched++;
        logs.push(`Updated "${post.title}": ${row.views || "no views"} views, ${row.shares || "no shares"} shares`);
        return { ...post, views: row.views ? Number(row.views.replace(/,/g, "")) || post.views : post.views, shares: row.shares ? Number(row.shares.replace(/,/g, "")) || post.shares : post.shares };
      });
      const skipped = records.length - matched;
      if (skipped) logs.push(`${skipped} row${skipped === 1 ? "" : "s"} skipped because no matching title was found`);
      logs.push(`Import complete: ${matched} matched, ${skipped} skipped`);
      setPosts(updated); setImportState({ progress: 100, logs, fileName: file.name, matched, skipped });
      notify("CSV imported.");
    };
    reader.onerror = () => setImportState({ progress: 100, logs: [`Could not read ${file.name}.`, "The browser reported a file read error. Check the file permissions or export the CSV again."], fileName: file.name, matched: 0, skipped: 0, error: true });
    reader.readAsText(file); e.target.value = "";
  };

  const maxTopicViews = Math.max(1, ...stats.topTopics.map(([, v]) => v));
  const maxPostViews = Math.max(1, ...stats.topPosts.map(p => p.views));

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div style={s.brand}>
            <img src={stackcraftLogo} alt="StackCraft" style={{ width: 42, height: 42, borderRadius: 10, boxShadow: "0 2px 8px rgba(17,24,39,.14)" }} />
            <div>
              <div style={s.brandName}>StackCraft</div>
              <div style={s.brandSub}>Connect · Write · Develop</div>
            </div>
            <a href="https://pandaabhishek.substack.com/" onClick={trackClick} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#555", textDecoration: "none", borderBottom: "1px solid #bbb" }}>
              Current writing <ExternalLink size={12} />
            </a>
          </div>
          <div style={s.launchPanel}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
              <strong style={{ fontSize: 13, color: "#111" }}>StackCraft.io is coming soon</strong>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.7, color: "#5d43c8", textTransform: "uppercase" }}>In progress</span>
            </div>
            <div style={{ fontSize: 11, color: "#5b6278", lineHeight: 1.45, marginBottom: 7 }}>A future-native home to connect, write, and build beyond today’s LinkedIn and Substack workflows.</div>
            <a href="https://www.stackcraft.io/" onClick={trackClick} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#2448c8", textDecoration: "none" }}>Visit stackcraft.io <ExternalLink size={12} /></a>
          </div>
        </div>

        {/* Stat strip */}
        <div style={s.statStrip}>
          {[
            { label: "Total posts", val: posts.length },
            { label: "Published", val: stats.published },
            { label: "Topics", val: ALL_TOPICS.length },
          ].map(({ label, val }) => (
            <div key={label} style={s.statBox}>
              <div style={s.statNum}>{val}</div>
              <div style={s.statLabel}>{label}</div>
            </div>
          ))}
        </div>

      </div>

      <div style={s.body}>
        {tab === "posts" && (
          <>
            <div style={s.toolbar}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts…" style={{ ...s.input, minWidth: 200 }} />
              <select value={fTopic} onChange={e => setFTopic(e.target.value)} style={s.input}>
                <option value="">All topics</option>
                {ALL_TOPICS.map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={fTag} onChange={e => setFTag(e.target.value)} style={s.input}>
                <option value="">All tags</option>
                {ALL_TAGS.map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={s.input}>
                <option value="">All status</option>
                {STATUSES.map(t => <option key={t}>{t}</option>)}
              </select>
              <span style={s.count}>{filtered.length} posts</span>
            </div>

            {groupedPosts.map(([topic, topicPosts]) => (
              <section key={topic} style={{ marginBottom: 14, border: "1px solid #e5e5e5", borderRadius: 5, overflow: "hidden" }}>
                <button onClick={() => toggleTopic(topic)} aria-expanded={expandedTopics.has(topic)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "none", borderBottom: expandedTopics.has(topic) ? "1px solid #e5e5e5" : "none", background: "#fafafa", cursor: "pointer", color: "#111" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800 }}><TopicIcon topic={topic} />{topic}<span style={{ color: "#999", fontSize: 11, fontWeight: 600 }}>{topicPosts.length} articles</span></span>
                  {expandedTopics.has(topic) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedTopics.has(topic) && <div style={{ overflowX: "auto" }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {[["#", "id", 36], ["Title", "title", "auto"], ["Tags", null, 150], ["Status", "status", 96], ["Link", null, 86]].map(([l, col, w]) => (
                          <th key={l} style={{ ...s.th, width: w }} onClick={col ? () => handleSort(col) : undefined}>
                            {l}{col && <Arr col={col} />}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                  {topicPosts.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ ...s.td, color: "#bbb", fontWeight: 700, fontSize: 11 }}>{p.id}</td>
                      <td style={{ ...s.td, maxWidth: 300 }}>
                        <div style={{ fontWeight: 600, color: "#111", fontSize: 12, marginBottom: 2 }}>{p.title}</div>
                        <div style={{ fontSize: 11, color: "#999", lineHeight: 1.4 }}>{p.description}</div>
                      </td>
                      <td style={s.td}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {p.tags.slice(0, 3).map(t => <TagPill key={t} tag={t} />)}
                          {p.tags.length > 3 && <span style={{ fontSize: 10, color: "#aaa" }}>+{p.tags.length - 3}</span>}
                        </div>
                      </td>
                      <td style={s.td}><StatusBadge status={p.status} /></td>
                      <td style={s.td}>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <a href={p.url} onClick={trackClick} target="_blank" rel="noreferrer" style={{ color: "#111", textDecoration: "none", display: "inline-flex" }} title="Open article" aria-label={`Open ${p.title}`}><ExternalLink size={14} /></a>
                          <button onClick={() => copyLink(p)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: copiedId === p.id ? "#090" : "#aaa", padding: 0 }} title="Copy link">
                            {copiedId === p.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                    </tbody>
                  </table>
                </div>}
              </section>
            ))}
            {groupedPosts.length === 0 && <div style={{ ...s.td, textAlign: "center", padding: 40, color: "#ccc" }}>No posts match.</div>}
          </>
        )}

        {tab === "analytics" && (
          <div>
            {stats.totalViews === 0 && (
              <div style={{ border: "1px solid #f0f0f0", borderRadius: 4, padding: "16px 20px", marginBottom: 24, color: "#999", fontSize: 12 }}>
                No view data yet. Import a CSV with columns <code>title,views,shares</code> or edit posts to add counts.
              </div>
            )}

            {/* Top posts */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, borderBottom: "1px solid #f0f0f0", paddingBottom: 8 }}>Top posts by views</div>
              {stats.topPosts.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#ccc", width: 18, textAlign: "right" }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#111", fontWeight: 500, marginBottom: 4 }}>{p.title}</div>
                    <div style={{ height: 3, background: "#f0f0f0", borderRadius: 2 }}>
                      <div style={{ height: 3, background: "#111", borderRadius: 2, width: `${(p.views / maxPostViews) * 100}%` }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#111", width: 60, textAlign: "right" }}>{p.views.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* By topic */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, borderBottom: "1px solid #f0f0f0", paddingBottom: 8 }}>Views by topic</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                {stats.topTopics.map(([topic, v]) => (
                  <div key={topic} style={{ border: "1px solid #e8e8e8", borderRadius: 4, padding: "12px 14px" }}>
                    <div title={topic} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#999", fontWeight: 600, marginBottom: 4 }}><TopicIcon topic={topic} />{topic}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#111", marginBottom: 6 }}>{v.toLocaleString()}</div>
                    <div style={{ height: 2, background: "#f0f0f0" }}>
                      <div style={{ height: 2, background: "#111", width: `${(v / maxTopicViews) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By tag */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, borderBottom: "1px solid #f0f0f0", paddingBottom: 8 }}>Views by tag</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {stats.topTags.map(([tag, v]) => (
                  <div key={tag} style={{ border: "1px solid #e8e8e8", borderRadius: 3, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                    <TagPill tag={tag} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>{v.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Full table */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, borderBottom: "1px solid #f0f0f0", paddingBottom: 8 }}>All posts performance</div>
              <table style={{ ...s.table }}>
                <thead>
                  <tr>
                    {["Title", "Topic", "Views", "Shares", "Status"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...posts].sort((a, b) => b.views - a.views).map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ ...s.td, fontSize: 12, color: "#111" }}>{p.title}</td>
                      <td style={{ ...s.td, fontSize: 11, color: "#666" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><TopicIcon topic={p.topic} />{p.topic}</span></td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{p.views.toLocaleString()}</td>
                      <td style={{ ...s.td, color: "#666" }}>{p.shares.toLocaleString()}</td>
                      <td style={s.td}><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalTitle}>{editId ? "Edit post" : "New post"}</div>
            {[["Title", "title", "text"], ["Topic", "topic", "text"], ["Tags (comma-separated)", "tags", "text"], ["URL", "url", "text"], ["Description", "description", "textarea"], ["Views", "views", "number"], ["Shares", "shares", "number"]].map(([label, key, type]) => (
              <div key={key} style={s.formField}>
                <label style={s.label}>{label}</label>
                {type === "textarea"
                  ? <textarea value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} rows={3} style={{ ...s.fullInput, resize: "vertical" }} />
                  : <input type={type} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={s.fullInput} />
                }
              </div>
            ))}
            <div style={s.formField}>
              <label style={s.label}>Status</label>
              <select value={form.status || "Draft"} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={s.fullInput}>
                {STATUSES.map(st => <option key={st}>{st}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button onClick={() => setModal(false)} style={s.btnGhost}>Cancel</button>
              <button onClick={save} style={s.btnPrimary}>Save</button>
            </div>
          </div>
        </div>
      )}

      {importState && (
        <div style={s.overlay} onClick={() => setImportState(null)}>
          <div style={{ ...s.modal, maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={s.modalTitle}>Import CSV report</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: -12 }}>{importState.fileName}</div>
              </div>
              <button onClick={() => setImportState(null)} style={s.btnGhost} aria-label="Close import report">Close</button>
            </div>
            <div style={{ height: 8, background: "#eee", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${importState.progress}%`, background: "#111", transition: "width 180ms ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#777", marginBottom: 16 }}>
              <span>{importState.progress === 100 ? "Parsing complete" : "Parsing CSV..."}</span>
              <strong>{importState.progress}%</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
              {[["Rows matched", importState.matched ?? "-"], ["Rows skipped", importState.skipped ?? "-"], ["Total views", stats.totalViews.toLocaleString()]].map(([label, value]) => (
                <div key={label} style={{ border: "1px solid #e8e8e8", padding: "10px 12px" }}><div style={s.statNum}>{value}</div><div style={s.statLabel}>{label}</div></div>
              ))}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Import log</div>
            <div style={s.logPanel}>{importState.logs.map((log, index) => <div key={`${log}-${index}`}><span style={{ color: "#777" }}>{String(index + 1).padStart(2, "0")} </span>{log}</div>)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Views by topic</div>
                {stats.topTopics.slice(0, 5).map(([topic, views]) => <div key={topic} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><TopicIcon topic={topic} />{topic}</span><strong>{views.toLocaleString()}</strong></div>)}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Recently published</div>
                {[...posts].filter(post => post.status === "Published").sort((a, b) => b.id - a.id).slice(0, 5).map(post => <div key={post.id} style={{ padding: "5px 0", borderBottom: "1px solid #f0f0f0", fontSize: 11 }}><div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{post.title}</div><span style={{ color: "#888" }}>{post.views.toLocaleString()} views · {post.shares.toLocaleString()} shares</span></div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={s.toast}>{toast}</div>}

      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", margin: "28px 32px 0", padding: "16px 0 22px", borderTop: "1px solid #e8e8e8", color: "#888", fontSize: 10 }}>
        <span>StackCraft · Connect · Write · Develop</span>
        <span title="Counts are stored privately in this browser">This browser · {visitCount.toLocaleString()} opens · {clickCount.toLocaleString()} link clicks</span>
      </footer>

      <style>{`* { box-sizing: border-box; } input, select, textarea { font-family: inherit; } button { font-family: inherit; }`}</style>
    </div>
  );
}
