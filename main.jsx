import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { SylvaHero } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";
import Dashboard from "./substack_bw_dashboard.jsx";
import CareerOSLanding from "./src/careeros/CareerOSLanding.jsx";
import StackCraftWorkspace from "./src/careeros/StackCraftWorkspace.jsx";
import { supabase } from "./supabase.js";
import "./stackcraft-nav.css";

const route = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
const careerLandingRoutes = new Set(["craft", "stackcraft", "careeros", "career-os", "career"]);
const careerWorkspaceRoutes = new Set(["craft/app","craft/workspace","stackcraft/app","stackcraft/workspace","careeros/app","careeros/workspace","career-os/app","career/app"]);
const legacyLandingRoutes = new Set(["stackcraft", "careeros", "career-os", "career"]);
const legacyWorkspaceRoutes = new Set(["stackcraft/app", "stackcraft/workspace", "careeros/app", "careeros/workspace", "career-os/app", "career/app"]);
if (legacyLandingRoutes.has(route)) window.history.replaceState({}, "", "/Craft");
if (legacyWorkspaceRoutes.has(route)) window.history.replaceState({}, "", "/Craft/app");

const STACKCRAFT_LOGIN = "/login?next=%2FCraft%2Fapp&product=stackcraft";
function setFavicon(href) { let icon=document.querySelector('link[rel="icon"]'); if(!icon){icon=document.createElement("link");icon.rel="icon";document.head.appendChild(icon)} icon.type="image/svg+xml";icon.href=href; let touch=document.querySelector('link[rel="apple-touch-icon"]');if(!touch){touch=document.createElement("link");touch.rel="apple-touch-icon";document.head.appendChild(touch)} touch.href="/stackcraft-mark.svg"; }

function StackCraftAuthBridge(){
  useEffect(()=>{
    if(route!=="login")return;
    const params=new URLSearchParams(window.location.search); if(params.get("product")!=="stackcraft")return;
    const next=params.get("next")||"/Craft/app"; let mounted=true;
    supabase.auth.getSession().then(({data})=>{if(mounted&&data.session)window.location.replace(next)});
    const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{if(mounted&&event==="SIGNED_IN"&&session)window.location.replace(next)});
    return()=>{mounted=false;listener.subscription.unsubscribe()};
  },[]);
  return null;
}

function StackCraftRouteMeta() { useEffect(() => { if (!careerLandingRoutes.has(route) && !careerWorkspaceRoutes.has(route)) return; document.title = careerWorkspaceRoutes.has(route) ? "StackCraft Dashboard | StackedIN" : "StackCraft — AI Career Operating System | StackedIN"; document.querySelector('meta[name="description"]')?.setAttribute("content","StackCraft is the private AI career operating system inside StackedIN for global job discovery, matching, applications, workflows, mobility intelligence, and AEON interview preparation."); setFavicon("/stackcraft-favicon.svg"); }, []); return null; }

function StackedINSylvaHero() {
  const [host, setHost] = useState(null);
  useEffect(() => { let currentHost=null; const install=()=>{const hero=document.querySelector(".marketing-hero");if(!hero)return;let nextHost=hero.querySelector('[data-stackedin-sylva="true"]');if(!nextHost){nextHost=document.createElement("div");nextHost.dataset.stackedinSylva="true";nextHost.className="stackedin-sylva-hero";hero.prepend(nextHost)}currentHost=nextHost;setHost(nextHost)};install();const observer=new MutationObserver(install);observer.observe(document.getElementById("root")||document.body,{childList:true,subtree:true});return()=>{observer.disconnect();currentHost?.remove();setHost(null)}},[]);
  if(!host)return null;
  return createPortal(<div className="shader-frame stackedin-sylva-hero__frame"><SylvaHero variant="living-green" headingFont="lexend" bodyFont="lexend" headingWeight="300" bodyWeight="300" primaryColor="#ffffff" headingSize={63} bodySize={16.5} headingLetterSpacing={-0.006}/></div>,host);
}

function buildStackCraftButton(className="nav-stackcraft-cta",labelText="Open StackCraft"){
  const button=document.createElement("button");button.type="button";button.className=className;button.title="Open StackCraft";button.setAttribute("aria-label","Open StackCraft using your StackedIN identity");
  const icon=document.createElement("img");icon.className="nav-stackcraft-cta__icon";icon.src="/stackcraft-mark.svg";icon.alt="";icon.setAttribute("aria-hidden","true");const label=document.createElement("span");label.className="nav-stackcraft-cta__label";label.textContent=labelText;button.append(icon,label);button.addEventListener("click",()=>window.location.assign(STACKCRAFT_LOGIN));return button;
}

function StackCraftNavLink() {
  useEffect(() => { let activeHeader=null; const install=()=>{const header=document.querySelector(".marketing-nav");const xstudioButton=header?.querySelector(".nav-cta");if(!header||!xstudioButton)return false;activeHeader=header;header.classList.add("marketing-nav--persistent");let actions=header.querySelector('[data-product-actions="true"]');if(!actions){actions=document.createElement("div");actions.dataset.productActions="true";actions.className="marketing-product-actions";xstudioButton.parentNode?.insertBefore(actions,xstudioButton);actions.appendChild(xstudioButton)}let stackCraftButton=actions.querySelector('[data-stackcraft-cta="true"]');if(!stackCraftButton){stackCraftButton=buildStackCraftButton();stackCraftButton.dataset.stackcraftCta="true";actions.insertBefore(stackCraftButton,xstudioButton)}xstudioButton.classList.add("nav-xstudio-capsule");return true};install();const observer=new MutationObserver(install);observer.observe(document.getElementById("root")||document.body,{childList:true,subtree:true});return()=>{observer.disconnect();document.querySelector('[data-stackcraft-cta="true"]')?.remove();const actions=document.querySelector('[data-product-actions="true"]');const xstudioButton=actions?.querySelector(".nav-cta");if(actions&&xstudioButton){xstudioButton.classList.remove("nav-xstudio-capsule");actions.parentNode?.insertBefore(xstudioButton,actions);actions.remove()}activeHeader?.classList.remove("marketing-nav--persistent")}},[]);return null;
}

function StackCraftAuthenticatedNav(){
  useEffect(()=>{const install=()=>{const candidates=[...document.querySelectorAll("a,button")].filter(el=>!el.closest(".marketing-nav") && (/xstudio/i.test(el.textContent||"") || (el.getAttribute("href")||"").startsWith("/studio")));for(const studio of candidates){const parent=studio.parentElement;if(!parent||parent.querySelector('[data-stackcraft-auth-nav="true"]'))continue;const b=buildStackCraftButton("stackcraft-app-capsule","StackCraft");b.dataset.stackcraftAuthNav="true";parent.insertBefore(b,studio)}};install();const observer=new MutationObserver(install);observer.observe(document.getElementById("root")||document.body,{childList:true,subtree:true});return()=>{observer.disconnect();document.querySelectorAll('[data-stackcraft-auth-nav="true"]').forEach(el=>el.remove())}},[]);return null;
}

function StackCraftBrandingBridge() { useEffect(() => { const rewriteText=root=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){if(node.nodeValue?.includes("CareerOS"))node.nodeValue=node.nodeValue.replaceAll("CareerOS","StackCraft")}};rewriteText(document.body);const observer=new MutationObserver(mutations=>{for(const mutation of mutations)for(const node of mutation.addedNodes){if(node.nodeType===Node.TEXT_NODE&&node.nodeValue?.includes("CareerOS"))node.nodeValue=node.nodeValue.replaceAll("CareerOS","StackCraft");else if(node.nodeType===Node.ELEMENT_NODE)rewriteText(node)}});observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[]);return null; }

createRoot(document.getElementById("root")).render(<React.StrictMode><StackCraftAuthBridge/><StackCraftRouteMeta/>{careerWorkspaceRoutes.has(route)?<><StackCraftWorkspace/><StackCraftBrandingBridge/></>:careerLandingRoutes.has(route)?<><CareerOSLanding/><StackCraftBrandingBridge/></>:<><Dashboard/><StackedINSylvaHero/><StackCraftNavLink/><StackCraftAuthenticatedNav/></>}</React.StrictMode>);
