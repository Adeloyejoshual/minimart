// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/SupportTicketDetail.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/SupportTicketDetail.css";

import {
  useState, useEffect, useRef,
  useCallback, memo, useMemo,
} from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

import {
  IconArrowLeft, IconSend, IconPaperclip, IconX,
  IconLock, IconCheckCircle, IconRotateCcw,
  IconAlertTriangle, IconClock, IconUser,
  IconLoader, IconRefresh,
} from "../../components/help/icons/HelpIcons";

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const BASE_URL      = import.meta.env.VITE_API_BASE_URL;
const POLL_INTERVAL = 20_000;
const LINE_CLAMP    = 8; // max visible lines before "read more"

const ALLOWED_TYPES = [
  "image/jpeg","image/png","image/gif","image/webp",
  "application/pdf","application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/* ════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authHeader = () => ({
  headers: { Authorization: `Bearer ${getToken()}` },
});

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function formatDateTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(d) {
  if (!d) return "";
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return formatDateTime(d);
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canReopenTicket(t) {
  if (!t || t.status !== "closed") return false;
  if (!t.reopen_deadline) return true;
  return new Date(t.reopen_deadline) > new Date();
}

function validateFile(f) {
  if (f.size > MAX_FILE_SIZE) return `"${f.name}" exceeds 10 MB.`;
  if (!ALLOWED_TYPES.includes(f.type)) return `"${f.name}" unsupported type.`;
  return null;
}

function unwrapTicket(data) {
  if (!data) return null;
  if (data.ticket?.id) return data.ticket;
  if (data.id)         return data;
  if (data.data?.id)   return data.data;
  return null;
}

function extractApiError(err, url) {
  if (axios.isCancel(err)) return null;
  if (!err.response) {
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout"))
      return { title:"Request timed out", detail:"Server took too long.",
               hint:"Check connection.", httpStatus:null, url, serverRaw:null };
    if (typeof navigator!=="undefined" && !navigator.onLine)
      return { title:"Offline", detail:"No internet detected.",
               hint:"Reconnect and retry.", httpStatus:null, url, serverRaw:null };
    return { title:"Network error", detail:err.message||"Cannot reach server.",
             hint:"Check connection.", httpStatus:null, url, serverRaw:null };
  }
  const { status, data, config } = err.response;
  let msg = null;
  if (typeof data==="string" && data.trim()) {
    if (data.trim().startsWith("<")) {
      const t=data.match(/<title[^>]*>([^<]+)<\/title>/i);
      msg=t?.[1]?.trim()||"HTML error page.";
    } else if (data.length<500) msg=data.trim();
  } else if (data && typeof data==="object") {
    const r=data.message||data.error?.message||(typeof data.error==="string"?data.error:null)||
            data.detail||data.errors?.[0]?.message||data.msg||data.reason||null;
    msg=r&&typeof r==="object"?JSON.stringify(r):r;
  }
  const titles={400:"Bad request",401:"Auth required",403:"Access denied",
    404:"Not found",422:"Invalid",429:"Too many requests",500:"Server error",
    502:"Bad gateway",503:"Unavailable",504:"Gateway timeout"};
  const hints={400:"Check input.",401:"Sign in again.",403:"Wrong account?",
    404:"Ticket may be deleted.",422:"Invalid ID format.",429:"Wait a moment.",
    500:"Server issue. Try shortly.",502:"Gateway down.",503:"Maintenance.",504:"Timed out."};
  return {
    title:`${titles[status]??"Error"} (${status})`,
    detail:msg||`HTTP ${status}`, hint:hints[status]||"Try again.",
    httpStatus:status, url:config?.url??url, serverRaw:data,
  };
}

/* ════════════════════════════════════════════════════════════
   AUTO-RESIZE TEXTAREA
════════════════════════════════════════════════════════════ */
function autoResize(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

/* ════════════════════════════════════════════════════════════
   STATUS BADGE
════════════════════════════════════════════════════════════ */
const STATUS_META = {
  open:"Open", in_progress:"In Progress",
  waiting_for_customer:"Waiting", resolved:"Resolved", closed:"Closed",
};

const StatusBadge = memo(function StatusBadge({ status }) {
  const k = status ?? "open";
  const mod = k === "waiting_for_customer" ? "waiting" : k;
  return <span className={`stdp-status-badge stdp-status-${mod}`}>{STATUS_META[k]??k}</span>;
});

const PriorityBadge = memo(function PriorityBadge({ priority }) {
  if (!priority) return null;
  return (
    <span className={`stdp-priority-badge stdp-priority-${priority}`}>
      {priority.charAt(0).toUpperCase()+priority.slice(1)}
    </span>
  );
});

/* ════════════════════════════════════════════════════════════
   CONFIRM DIALOG
════════════════════════════════════════════════════════════ */
const ConfirmDialog = memo(function ConfirmDialog({ title, body, onConfirm, onCancel }) {
  return (
    <div className="stdp-overlay" role="dialog" aria-modal="true">
      <div className="stdp-dialog">
        <h3 className="stdp-dialog-title">{title}</h3>
        <p className="stdp-dialog-body">{body}</p>
        <div className="stdp-dialog-actions">
          <button className="stdp-dialog-cancel" onClick={onCancel}>Cancel</button>
          <button className="stdp-dialog-confirm" onClick={onConfirm}>Close Ticket</button>
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   TICKET MESSAGE — no "You", time under bubble, long clamp
════════════════════════════════════════════════════════════ */
const TicketMessage = memo(function TicketMessage({ msg, isOwn, isSystem }) {
  const [expanded, setExpanded] = useState(false);

  if (isSystem) {
    return (
      <div className="stdp-msg-system">
        <span>{msg.message}</span>
      </div>
    );
  }

  const side = isOwn ? "stdp-msg--own" : "stdp-msg--agent";
  const isLong = (msg.message?.length ?? 0) > 400;
  const clamped = isLong && !expanded;

  return (
    <div className={`stdp-msg ${side}`}>
      {/* Avatar — only for agent */}
      {!isOwn && (
        <div className="stdp-msg-avatar" aria-hidden="true">
          {msg.sender_avatar
            ? <img src={msg.sender_avatar} alt={msg.sender_name ?? "Agent"} />
            : <IconUser size={15} />
          }
        </div>
      )}

      <div className="stdp-msg-content">
        <div
          className={`stdp-msg-bubble${clamped ? " stdp-msg-bubble--clamped" : ""}`}
          onClick={clamped ? () => setExpanded(true) : undefined}
          role={clamped ? "button" : undefined}
          tabIndex={clamped ? 0 : undefined}
          onKeyDown={clamped ? (e) => { if(e.key==="Enter") setExpanded(true); } : undefined}
        >
          {msg.message}
        </div>

        {/* Time — under bubble */}
        <span className="stdp-msg-time" title={formatDateTime(msg.created_at)}>
          {timeAgo(msg.created_at)}
        </span>

        {/* Attachments */}
        {msg.attachments?.length > 0 && (
          <div className="stdp-msg-attachments">
            {msg.attachments.map((att) => {
              const isImg = att.file_type?.startsWith("image/");
              return (
                <div key={att.id}>
                  {isImg && (
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={att.file_url} alt={att.file_name}
                        className="stdp-att-preview"
                        onError={(e)=>{e.currentTarget.style.display="none";}}
                      />
                    </a>
                  )}
                  <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="stdp-att-link">
                    <IconPaperclip size={11} />
                    <span className="stdp-att-name">{att.file_name}</span>
                    {att.file_size && <span className="stdp-att-size">{formatBytes(att.file_size)}</span>}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   ERROR STATE
════════════════════════════════════════════════════════════ */
const ErrorState = memo(function ErrorState({ id, error, onRetry }) {
  const navigate = useNavigate();
  const [raw, setRaw] = useState(false);
  const noRetry = [403,404,410].includes(error?.httpStatus);
  const is500 = (error?.httpStatus??0)>=500;

  return (
    <div className="stdp-page">
      <div className="stdp-container">
        <div className="stdp-error" role="alert">
          <div className="stdp-error-icon"><IconAlertTriangle size={22}/></div>
          <h2 className="stdp-error-title">{error?.title??"Could not load ticket"}</h2>
          <p className="stdp-error-detail">{error?.detail??"Unexpected error."}</p>
          {error?.hint && <p className="stdp-error-hint">💡 {error.hint}</p>}

          {(id||error?.httpStatus||error?.url) && (
            <div className="stdp-error-table">
              {id && <div className="stdp-error-row"><span className="stdp-error-key">Ticket</span><code className="stdp-error-val">{id}</code></div>}
              {error?.httpStatus && <div className="stdp-error-row"><span className="stdp-error-key">HTTP</span><code className={`stdp-error-val${is500?" stdp-error-val--red":""}`}>{error.httpStatus}</code></div>}
              {error?.url && <div className="stdp-error-row"><span className="stdp-error-key">Endpoint</span><code className="stdp-error-val stdp-error-val--url">{error.url}</code></div>}
            </div>
          )}

          {error?.serverRaw!=null && (
            <>
              <button className="stdp-error-raw-toggle" onClick={()=>setRaw(v=>!v)} aria-expanded={raw}>
                {raw?"▾ Hide":"▸ Show"} server response
              </button>
              {raw && <pre className="stdp-error-raw">{typeof error.serverRaw==="string"?error.serverRaw:JSON.stringify(error.serverRaw,null,2)}</pre>}
            </>
          )}

          <div className="stdp-error-actions">
            {!noRetry && <button className="stdp-error-btn-primary" onClick={onRetry}><IconRefresh size={14}/> Try Again</button>}
            {error?.httpStatus===401 && <button className="stdp-error-btn-primary" onClick={()=>navigate("/auth?redirect="+encodeURIComponent(window.location.pathname))}>Sign In</button>}
            <Link to="/support/tickets" className="stdp-error-btn-ghost"><IconArrowLeft size={14}/> Tickets</Link>
          </div>

          {is500 && <p className="stdp-error-500-note">Server error — not your fault. <Link to="/support" className="stdp-error-link">Contact support</Link> if it persists.</p>}
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   LOADING
════════════════════════════════════════════════════════════ */
const LoadingState = memo(function LoadingState() {
  return (
    <div className="stdp-page">
      <div className="stdp-container">
        <div className="stdp-loading" role="status" aria-busy="true">
          <IconLoader size={26} className="stdp-spinner" />
          <p>Loading ticket…</p>
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function SupportTicketDetail({ user }) {
  const params = useParams();

  const id = useMemo(() => {
    const p = params.id||params.ticketId||params.ticket_id||null;
    if (p && p!=="undefined" && p!=="null") return p;
    const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const parts=window.location.pathname.split("/").filter(Boolean);
    for (let i=parts.length-1;i>=0;i--) if(UUID.test(parts[i])) return parts[i];
    return null;
  }, [params]);

  const [ticket,      setTicket]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [apiError,    setApiError]    = useState(null);
  const [reply,       setReply]       = useState("");
  const [files,       setFiles]       = useState([]);
  const [previews,    setPreviews]    = useState({});
  const [sending,     setSending]     = useState(false);
  const [actionBusy,  setActionBusy]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fileRef      = useRef(null);
  const threadRef    = useRef(null);
  const textareaRef  = useRef(null);
  const isMounted    = useRef(true);
  const shouldScroll = useRef(true);
  const pollRef      = useRef(null);
  const abortRef     = useRef(null);

  /* ── Load ticket ── */
  const loadTicket = useCallback(async (silent=false) => {
    const token=getToken();
    const url=`${BASE_URL}/api/support/tickets/${id}`;

    if (!token) {
      if(!silent){setApiError({title:"Auth required",detail:"Sign in to view tickets.",hint:"Tap Sign In.",httpStatus:401,url:null,serverRaw:null});setLoading(false);}
      return;
    }
    if (!id) {
      if(!silent){setApiError({title:"Missing ID",detail:"No ticket ID in URL.",hint:"Go back and select a ticket.",httpStatus:null,url:null,serverRaw:null});setLoading(false);}
      return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      if(!silent){setApiError({title:"Invalid ID",detail:`"${id}" is not a UUID.`,hint:"Check the URL.",httpStatus:422,url:null,serverRaw:null});setLoading(false);}
      return;
    }

    abortRef.current?.abort();
    const ctrl=new AbortController();
    abortRef.current=ctrl;

    try {
      const {data}=await axios.get(url,{headers:{Authorization:`Bearer ${token}`},signal:ctrl.signal,timeout:15_000});
      if(!isMounted.current) return;
      const td=unwrapTicket(data);
      if(!td){
        if(!silent) setApiError({title:"Empty response",detail:"No ticket data returned.",hint:"Try again.",httpStatus:null,url,serverRaw:data});
      } else {
        setTicket(td);
        setApiError(null);
      }
    } catch(err) {
      if(!isMounted.current||axios.isCancel(err)) return;
      console.group(`%c[Ticket ${id}] Error`,"color:red;font-weight:bold");
      console.error("URL:",url,"Status:",err?.response?.status,"Body:",err?.response?.data);
      console.groupEnd();
      if(!silent) setApiError(extractApiError(err,url));
    } finally {
      if(isMounted.current && !silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    isMounted.current=true;
    setLoading(true); setApiError(null); setTicket(null);
    loadTicket(false);
    return () => { isMounted.current=false; abortRef.current?.abort(); clearInterval(pollRef.current); };
  }, [loadTicket]);

  /* Polling — skip hidden tab */
  useEffect(() => {
    const start=()=>{
      clearInterval(pollRef.current);
      pollRef.current=setInterval(()=>{
        if(isMounted.current && !document.hidden) loadTicket(true);
      }, POLL_INTERVAL);
    };
    start();
    document.addEventListener("visibilitychange",start);
    return ()=>{ clearInterval(pollRef.current); document.removeEventListener("visibilitychange",start); };
  }, [loadTicket]);

  /* Auto-scroll */
  useEffect(()=>{
    const el=threadRef.current;
    if(!el) return;

    // switch layout when content overflows
    if(el.scrollHeight>el.clientHeight) {
      el.classList.add("stdp-thread--scrollable");
    } else {
      el.classList.remove("stdp-thread--scrollable");
    }

    if(shouldScroll.current) el.scrollTop=el.scrollHeight;
  }, [ticket?.messages?.length]);

  /* ── Derived ── */
  const {isClosed,isResolved,reopenOk,canClose,messages,currentUserId} = useMemo(()=>{
    if(!ticket) return {isClosed:false,isResolved:false,reopenOk:false,canClose:false,messages:[],currentUserId:null};
    return {
      isClosed:ticket.status==="closed",
      isResolved:ticket.status==="resolved",
      reopenOk:canReopenTicket(ticket),
      canClose:["open","waiting_for_customer","in_progress","resolved"].includes(ticket.status),
      messages:Array.isArray(ticket.messages)?ticket.messages:[],
      currentUserId:user?.id??user?._id??user?.user_id??user?.uuid??null,
    };
  }, [ticket,user]);

  /* ── Files ── */
  const handleFileChange = useCallback((e)=>{
    const sel=Array.from(e.target.files||[]);
    const errs=[], valid=[];
    const seen=new Set(files.map(f=>`${f.name}-${f.size}`));
    for(const f of sel){
      const k=`${f.name}-${f.size}`;
      if(seen.has(k)){errs.push(`"${f.name}" already attached.`);continue;}
      const err=validateFile(f);
      if(err){errs.push(err);continue;}
      valid.push(f); seen.add(k);
    }
    if(errs.length) toast.error(errs.join("\n"),{duration:4000});
    const next=[...files,...valid].slice(0,5);
    setFiles(next);
    next.forEach(f=>{
      const k=`${f.name}-${f.size}`;
      if(!f.type.startsWith("image/")||previews[k]) return;
      const r=new FileReader();
      r.onload=ev=>{ if(isMounted.current) setPreviews(p=>({...p,[k]:ev.target.result})); };
      r.readAsDataURL(f);
    });
    e.target.value="";
  }, [files,previews]);

  const removeFile = useCallback((i)=>{
    setFiles(prev=>{
      const rm=prev[i];
      if(rm) setPreviews(p=>{const n={...p};delete n[`${rm.name}-${rm.size}`];return n;});
      return prev.filter((_,idx)=>idx!==i);
    });
  }, []);

  const resetPoll = useCallback(()=>{
    clearInterval(pollRef.current);
    pollRef.current=setInterval(()=>{
      if(isMounted.current && !document.hidden) loadTicket(true);
    }, POLL_INTERVAL);
  }, [loadTicket]);

  /* ── Send reply — optimistic ── */
  const handleReply = useCallback(async()=>{
    if(!reply.trim() && files.length===0) return;
    setSending(true);
    shouldScroll.current=true;

    const opt={
      id:`opt-${Date.now()}`, sender_id:currentUserId,
      sender_name:null, sender_avatar:null,
      message:reply.trim(), created_at:new Date().toISOString(),
      attachments:[], is_system_message:false, _optimistic:true,
    };

    setTicket(p=>p?{...p,messages:[...(p.messages??[]),opt]}:p);
    const txt=reply.trim(), fs=[...files];
    setReply(""); setFiles([]); setPreviews({});
    if(textareaRef.current) autoResize(textareaRef.current);

    try {
      const fd=new FormData();
      fd.append("message",txt);
      fs.forEach(f=>fd.append("attachments",f));
      await axios.post(`${BASE_URL}/api/support/tickets/${id}/messages`,fd,{
        headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"multipart/form-data"},
      });
      toast.success("Reply sent");
      resetPoll();
      await loadTicket(true);
    } catch(err) {
      setTicket(p=>p?{...p,messages:(p.messages??[]).filter(m=>!m._optimistic)}:p);
      setReply(txt); setFiles(fs);
      const parsed=extractApiError(err,`${BASE_URL}/api/support/tickets/${id}/messages`);
      toast.error(parsed?.detail??"Failed to send.");
    } finally { setSending(false); }
  }, [reply,files,id,currentUserId,loadTicket,resetPoll]);

  const handleKeyDown = useCallback((e)=>{
    if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){e.preventDefault();handleReply();}
  }, [handleReply]);

  /* ── Close / reopen ── */
  const handleClose = useCallback(async()=>{
    setShowConfirm(false); setActionBusy(true);
    try {
      await axios.patch(`${BASE_URL}/api/support/tickets/${id}`,{status:"closed"},authHeader());
      toast.success("Ticket closed."); await loadTicket(false);
    } catch(err) {
      toast.error(extractApiError(err)?.detail??"Failed to close.");
    } finally { setActionBusy(false); }
  }, [id,loadTicket]);

  const handleReopen = useCallback(async()=>{
    setActionBusy(true);
    try {
      await axios.post(`${BASE_URL}/api/support/tickets/${id}/reopen`,{},authHeader());
      toast.success("Ticket reopened."); await loadTicket(false);
    } catch(err) {
      toast.error(extractApiError(err)?.detail??"Failed to reopen.");
    } finally { setActionBusy(false); }
  }, [id,loadTicket]);

  const handleRetry = useCallback(()=>{
    abortRef.current?.abort();
    setLoading(true); setApiError(null); setTicket(null);
    loadTicket(false);
  }, [loadTicket]);

  /* ── Guards ── */
  if(loading) return <LoadingState/>;
  if(apiError || !ticket) return <ErrorState id={id} error={apiError} onRetry={handleRetry}/>;

  const replyDisabled = sending||actionBusy||(!reply.trim()&&files.length===0);

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="stdp-page">
      <div className="stdp-container">

        {showConfirm && (
          <ConfirmDialog
            title="Close this ticket?"
            body="Once closed you have 7 days to reopen. Are you sure?"
            onConfirm={handleClose}
            onCancel={()=>setShowConfirm(false)}
          />
        )}

        {/* Header */}
        <div className="stdp-header">
          <Link to="/support/tickets" className="stdp-back" aria-label="Back">
            <IconArrowLeft size={18}/>
          </Link>
          <div className="stdp-header-info">
            <div className="stdp-header-badges">
              <span className="stdp-ticket-number">{ticket.ticket_number}</span>
              <StatusBadge status={ticket.status}/>
              <PriorityBadge priority={ticket.priority}/>
            </div>
            <h1 className="stdp-subject" title={ticket.subject}>{ticket.subject}</h1>
            <div className="stdp-meta">
              {ticket.category && <>
                <span className="stdp-category">{ticket.category}</span>
                <span className="stdp-dot" aria-hidden="true"/>
              </>}
              <span className="stdp-date" title={formatDateTime(ticket.created_at)}>
                <IconClock size={11}/>{timeAgo(ticket.created_at)}
              </span>
            </div>
          </div>
          <button className="stdp-refresh-btn" onClick={()=>loadTicket(false)} aria-label="Refresh" disabled={actionBusy||sending}>
            <IconRefresh size={15}/>
          </button>
        </div>

        {/* Actions */}
        <div className="stdp-actions">
          {canClose && (
            <button onClick={()=>setShowConfirm(true)} disabled={actionBusy||sending} className="stdp-action-btn stdp-action-close">
              <IconLock size={14}/> Close
            </button>
          )}
          {reopenOk && (
            <button onClick={handleReopen} disabled={actionBusy||sending} className="stdp-action-btn stdp-action-reopen">
              <IconRotateCcw size={14}/> Reopen
            </button>
          )}
          {isClosed && !reopenOk && (
            <div className="stdp-action-expired" role="status">
              <IconAlertTriangle size={13}/> Reopen expired
            </div>
          )}
        </div>

        {/* Thread */}
        <div
          className="stdp-thread"
          ref={threadRef}
          role="log"
          aria-live="polite"
          onScroll={()=>{
            const el=threadRef.current;
            if(!el) return;
            shouldScroll.current = el.scrollHeight-el.scrollTop-el.clientHeight<80;
          }}
        >
          {messages.length===0 && !ticket.description && (
            <div className="stdp-thread-empty">No messages yet. Start below.</div>
          )}

          {messages.length===0 && ticket.description && (
            <TicketMessage
              msg={{id:"__desc__",sender_id:ticket.user_id,sender_name:null,
                    sender_avatar:null,message:ticket.description,
                    created_at:ticket.created_at,attachments:[],is_system_message:false}}
              isOwn={true} isSystem={false}
            />
          )}

          {messages.map(msg=>{
            const isOwn = currentUserId
              ? String(msg.sender_id)===String(currentUserId)
              : (msg.sender_role==="customer"||msg.sender_role==="user");
            return (
              <TicketMessage key={msg.id} msg={msg} isOwn={isOwn} isSystem={!!msg.is_system_message}/>
            );
          })}
        </div>

        {/* Reply — sticky bottom */}
        {!isClosed && (
          <div className="stdp-reply-box">
            <label htmlFor="stdp-ta" className="stdp-sr-only">Reply</label>
            <textarea
              id="stdp-ta"
              ref={textareaRef}
              value={reply}
              onChange={(e)=>{ setReply(e.target.value); autoResize(e.target); }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              className="stdp-reply-textarea"
              disabled={sending||actionBusy}
            />

            {files.length>0 && (
              <div className="stdp-reply-files" role="list">
                {files.map((f,i)=>{
                  const k=`${f.name}-${f.size}`;
                  return (
                    <div key={`${k}-${i}`} className="stdp-reply-chip" role="listitem">
                      {f.type.startsWith("image/")&&previews[k]&&(
                        <img src={previews[k]} alt={f.name} className="stdp-reply-chip-thumb"/>
                      )}
                      <IconPaperclip size={11} aria-hidden="true"/>
                      <span className="stdp-reply-chip-name">{f.name}</span>
                      <span className="stdp-reply-chip-size">{formatBytes(f.size)}</span>
                      <button type="button" onClick={()=>removeFile(i)} className="stdp-reply-chip-remove" aria-label={`Remove ${f.name}`}>
                        <IconX size={11}/>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="stdp-reply-toolbar">
              <button type="button" onClick={()=>fileRef.current?.click()} className="stdp-attach-btn" disabled={sending||files.length>=5} aria-label="Attach">
                <IconPaperclip size={14}/>
                {files.length>=5?"Max 5":"Attach"}
              </button>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileChange} className="stdp-file-hidden" tabIndex={-1} aria-hidden="true"/>
              <button onClick={handleReply} disabled={replyDisabled} className="stdp-send-btn" aria-busy={sending}>
                {sending
                  ? <><IconLoader size={14} className="stdp-spinner"/> Sending…</>
                  : <><IconSend size={14}/> Send</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Banners */}
        {isResolved && (
          <div className="stdp-banner stdp-banner--resolved" role="status">
            <IconCheckCircle size={18}/> Resolved
          </div>
        )}
        {isClosed && (
          <div className="stdp-banner stdp-banner--closed" role="status">
            <IconLock size={16}/> Closed{reopenOk&&" — tap Reopen above"}
          </div>
        )}

      </div>
    </div>
  );
}