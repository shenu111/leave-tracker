import { useState, useEffect, useCallback } from "react";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyhvl7lZtjX2h3o79Em3nCzyvn6hHxUEOo0c17B4wTv1QELtjYGjf4dJpI-R1ECuamF/exec";

const TEAM = ["DIN","PRIU","SIVP","SIVT","BALM","KAGA","RANG","PRIL","SUBA","KART","MAHE","SHAN"];

const LEAVE_TYPES = {
  FULL: { label: "Full Day",       color: "#F87171", icon: "●" },
  HALF: { label: "Half Day",       color: "#FBBF24", icon: "◐" },
  WFH:  { label: "Work From Home", color: "#60A5FA", icon: "⌂" },
};

const MEMBER_COLORS = [
  "#F87171","#FB923C","#FBBF24","#34D399","#60A5FA",
  "#A78BFA","#F472B6","#22D3EE","#86EFAC","#C084FC",
  "#FCA5A5","#6EE7B7"
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function toDateStr(y, m, d) {
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function getDaysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }
function memberColor(m) { return MEMBER_COLORS[TEAM.indexOf(m) % MEMBER_COLORS.length]; }

function getLeavesForDay(leaves, y, mo, d) {
  const ds = toDateStr(y, mo, d);
  return leaves.filter(l => l.Start <= ds && l.End >= ds);
}

export default function App() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth());
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [tab, setTab]         = useState("calendar");
  const [selectedDay, setSelectedDay] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editLeave, setEditLeave] = useState(null);
  const [form, setForm] = useState({ Member:"DIN", Start:"", End:"", Type:"FULL" });
  const [toast, setToast] = useState("");
  const [filterMember, setFilterMember] = useState("ALL");

  const apiFetch = useCallback(async (body) => {
    const res = await fetch(SCRIPT_URL, { method:"POST", body: JSON.stringify(body) });
    return res.json();
  }, []);

  const loadLeaves = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getAll`);
      const json = await res.json();
      setLeaves(json.data || []);
    } catch { setError("Could not connect. Check your internet connection."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadLeaves(); }, [loadLeaves]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const openAdd = () => {
    const d = toDateStr(year, month, selectedDay || now.getDate());
    setForm({ Member:"DIN", Start:d, End:d, Type:"FULL" });
    setEditLeave(null); setShowForm(true);
  };
  const openEdit = (l) => {
    setForm({ Member:l.Member, Start:l.Start, End:l.End, Type:l.Type });
    setEditLeave(l); setShowForm(true);
  };

  const saveLeave = async () => {
    if (!form.Start || !form.End) return;
    if (form.End < form.Start) { setError("End date must be after start date."); return; }
    setSaving(true); setError("");
    try {
      if (editLeave) {
        await apiFetch({ action:"update", id:editLeave.ID, ...form });
        showToast("Leave updated ✓");
      } else {
        await apiFetch({ action:"add", ...form });
        showToast("Leave logged ✓");
      }
      await loadLeaves();
      setShowForm(false);
    } catch { setError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  };

  const deleteLeave = async (l) => {
    if (!window.confirm(`Delete leave for ${l.Member}?`)) return;
    setSaving(true);
    try {
      await apiFetch({ action:"delete", id:l.ID });
      showToast("Entry deleted");
      await loadLeaves();
      setSelectedDay(null);
    } catch { setError("Failed to delete."); }
    finally { setSaving(false); }
  };

  const exportCSV = () => {
    const ml = getMonthLeaves();
    const sorted = [...ml].sort((a,b) => a.Start.localeCompare(b.Start));
    const rows = [["ID","Member","Start Date","End Date","Leave Type","Logged At"]];
    sorted.forEach(l => rows.push([l.ID, l.Member, l.Start, l.End, LEAVE_TYPES[l.Type]?.label || l.Type, l.Timestamp || ""]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Leave_${MONTHS[month]}_${year}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast("Downloaded ✓");
  };

  const getMonthLeaves = () => {
    const ms = `${year}-${String(month+1).padStart(2,"0")}`;
    return leaves.filter(l => l.Start?.slice(0,7) === ms || l.End?.slice(0,7) === ms);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDay(year, month);
  const monthLeaves = getMonthLeaves();
  const filteredMonthLeaves = filterMember === "ALL" ? monthLeaves : monthLeaves.filter(l => l.Member === filterMember);
  const todayLeaves = getLeavesForDay(leaves, now.getFullYear(), now.getMonth(), now.getDate());
  const dayLeaves   = selectedDay ? getLeavesForDay(leaves, year, month, selectedDay) : [];

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); setSelectedDay(null); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); setSelectedDay(null); };

  return (
    <div style={{minHeight:"100vh",background:"#0A0F1E",fontFamily:"'DM Sans',system-ui,sans-serif",color:"#E2E8F0",maxWidth:480,margin:"0 auto",paddingBottom:90,position:"relative",overflowX:"hidden"}}>

      <div style={{position:"fixed",top:-80,left:-80,width:300,height:300,background:"radial-gradient(circle,#3B82F622 0%,transparent 70%)",pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"fixed",bottom:100,right:-60,width:250,height:250,background:"radial-gradient(circle,#8B5CF622 0%,transparent 70%)",pointerEvents:"none",zIndex:0}}/>

      {/* Header */}
      <div style={{position:"relative",zIndex:1,padding:"40px 20px 20px",background:"linear-gradient(180deg,#0D1526 0%,transparent 100%)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div>
            <div style={{fontSize:11,letterSpacing:4,color:"#475569",textTransform:"uppercase",marginBottom:4}}>Team Manager</div>
            <div style={{fontSize:28,fontWeight:800,letterSpacing:-1,background:"linear-gradient(135deg,#F8FAFC,#94A3B8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Leave Tracker</div>
          </div>
          <button onClick={loadLeaves} style={{background:"#1E293B",border:"1px solid #334155",color:"#60A5FA",width:42,height:42,borderRadius:13,fontSize:18,cursor:"pointer"}}>↻</button>
        </div>
        <div style={{background:"#111827",borderRadius:16,padding:16,border:"1px solid #1E293B"}}>
          <div style={{fontSize:11,color:"#475569",marginBottom:10,letterSpacing:2,textTransform:"uppercase"}}>Today — {now.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</div>
          <div style={{display:"flex",gap:8}}>
            {Object.entries(LEAVE_TYPES).map(([k,v]) => {
              const count = todayLeaves.filter(l=>l.Type===k).length;
              return (
                <div key={k} style={{flex:1,background:"#0A0F1E",borderRadius:12,padding:"10px 8px",textAlign:"center",border:`1px solid ${count>0?v.color+"44":"#1E293B"}`}}>
                  <div style={{fontSize:18,color:count>0?v.color:"#334155"}}>{v.icon}</div>
                  <div style={{fontSize:20,fontWeight:800,color:count>0?v.color:"#1E293B",lineHeight:1.2}}>{count}</div>
                  <div style={{fontSize:9,color:"#475569",marginTop:2}}>{v.label}</div>
                </div>
              );
            })}
          </div>
          {todayLeaves.length > 0 && (
            <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:5}}>
              {todayLeaves.map(l => (
                <div key={l.ID} style={{background:memberColor(l.Member)+"22",border:`1px solid ${memberColor(l.Member)}44`,borderRadius:8,padding:"3px 8px",fontSize:11,fontWeight:700,color:memberColor(l.Member),display:"flex",alignItems:"center",gap:4}}>
                  <span style={{color:LEAVE_TYPES[l.Type]?.color,fontSize:10}}>{LEAVE_TYPES[l.Type]?.icon}</span>{l.Member}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",margin:"0 16px 16px",background:"#111827",borderRadius:14,padding:4,border:"1px solid #1E293B",position:"relative",zIndex:1}}>
        {[["calendar","📅","Calendar"],["list","📋","Log"],["export","📊","Export"]].map(([t,ic,lb])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"9px 0",border:"none",borderRadius:11,cursor:"pointer",background:tab===t?"linear-gradient(135deg,#3B82F6,#6366F1)":"transparent",color:tab===t?"#fff":"#475569",fontWeight:600,fontSize:12,transition:"all 0.2s"}}>{ic} {lb}</button>
        ))}
      </div>

      {error && <div style={{margin:"0 16px 12px",background:"#3B1212",border:"1px solid #991B1B",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#FCA5A5",position:"relative",zIndex:1}}>{error}</div>}
      {toast && <div style={{position:"fixed",bottom:100,left:"50%",transform:"translateX(-50%)",background:"#059669",color:"#fff",padding:"10px 20px",borderRadius:12,fontSize:13,fontWeight:600,zIndex:200,whiteSpace:"nowrap",boxShadow:"0 8px 24px #05966944"}}>{toast}</div>}

      {loading && <div style={{textAlign:"center",padding:60,color:"#475569",position:"relative",zIndex:1,fontSize:14}}>Loading from Google Sheet...</div>}

      {/* Calendar Tab */}
      {!loading && tab==="calendar" && (
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px 12px"}}>
            <button onClick={prevMonth} style={{background:"#1E293B",border:"none",color:"#94A3B8",width:38,height:38,borderRadius:11,fontSize:20,cursor:"pointer"}}>‹</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontWeight:800,fontSize:18,letterSpacing:-0.5}}>{MONTHS[month]} {year}</div>
              <div style={{fontSize:11,color:"#475569"}}>{monthLeaves.length} entries</div>
            </div>
            <button onClick={nextMonth} style={{background:"#1E293B",border:"none",color:"#94A3B8",width:38,height:38,borderRadius:11,fontSize:20,cursor:"pointer"}}>›</button>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:14,padding:"0 20px 14px"}}>
            {Object.entries(LEAVE_TYPES).map(([k,v])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#64748B"}}>
                <span style={{color:v.color,fontSize:13}}>{v.icon}</span>{v.label}
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 10px",marginBottom:4}}>
            {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#334155",padding:"2px 0",letterSpacing:1}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 10px",gap:3}}>
            {Array(firstDay).fill(null).map((_,i)=><div key={"b"+i}/>)}
            {Array(daysInMonth).fill(null).map((_,i)=>{
              const day=i+1;
              const dl=getLeavesForDay(leaves,year,month,day);
              const isToday=day===now.getDate()&&month===now.getMonth()&&year===now.getFullYear();
              const isSelected=day===selectedDay;
              const weekend=new Date(year,month,day).getDay()===0||new Date(year,month,day).getDay()===6;
              return (
                <div key={day} onClick={()=>setSelectedDay(day===selectedDay?null:day)} style={{minHeight:64,borderRadius:11,padding:"4px 3px",cursor:"pointer",background:isSelected?"#1D4ED8":isToday?"#1E3A5F":weekend?"#0D1526":"#111827",border:isSelected?"2px solid #60A5FA":isToday?"2px solid #3B82F655":"2px solid transparent",transition:"all 0.15s"}}>
                  <div style={{fontSize:10,fontWeight:isToday?800:500,color:isToday?"#60A5FA":isSelected?"#BAE6FD":weekend?"#334155":"#475569",textAlign:"right",paddingRight:2}}>{day}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:2,marginTop:2}}>
                    {dl.slice(0,3).map(l=>(
                      <div key={l.ID} style={{background:LEAVE_TYPES[l.Type]?.color+"25",borderLeft:`2px solid ${LEAVE_TYPES[l.Type]?.color||"#666"}`,borderRadius:"0 4px 4px 0",padding:"1px 3px",display:"flex",alignItems:"center",gap:2}}>
                        <span style={{fontSize:7,color:LEAVE_TYPES[l.Type]?.color}}>{LEAVE_TYPES[l.Type]?.icon}</span>
                        <span style={{fontSize:8,fontWeight:800,color:memberColor(l.Member),overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.Member}</span>
                      </div>
                    ))}
                    {dl.length>3&&<div style={{fontSize:8,color:"#60A5FA",textAlign:"center",fontWeight:700}}>+{dl.length-3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedDay && (
            <div style={{margin:"16px 12px 0",background:"#111827",borderRadius:16,padding:16,border:"1px solid #1E293B"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:15,color:"#93C5FD"}}>{MONTHS[month]} {selectedDay}</div>
                <div style={{fontSize:12,color:"#475569"}}>{dayLeaves.length} {dayLeaves.length===1?"person":"people"}</div>
              </div>
              {dayLeaves.length===0&&<div style={{color:"#334155",fontSize:13,textAlign:"center",padding:"12px 0"}}>No entries on this day 🎉</div>}
              {dayLeaves.map(l=>(
                <div key={l.ID} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0A0F1E",borderRadius:12,padding:"10px 12px",marginBottom:8,border:"1px solid #1E293B"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:36,height:36,borderRadius:10,background:memberColor(l.Member)+"33",border:`2px solid ${memberColor(l.Member)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:memberColor(l.Member)}}>{l.Member}</div>
                    <div>
                      <div style={{fontWeight:700,fontSize:13}}>{l.Member}</div>
                      <div style={{fontSize:11,color:LEAVE_TYPES[l.Type]?.color||"#666",display:"flex",alignItems:"center",gap:3,marginTop:1}}>{LEAVE_TYPES[l.Type]?.icon} {LEAVE_TYPES[l.Type]?.label}</div>
                      <div style={{fontSize:10,color:"#334155",marginTop:1}}>{l.Start===l.End?l.Start:`${l.Start} → ${l.End}`}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>openEdit(l)} style={{background:"#1E3A5F",border:"none",color:"#93C5FD",padding:"6px 11px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>deleteLeave(l)} style={{background:"#3B1212",border:"none",color:"#FCA5A5",padding:"6px 11px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List Tab */}
      {!loading && tab==="list" && (
        <div style={{padding:"0 12px",position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <button onClick={prevMonth} style={{background:"#1E293B",border:"none",color:"#94A3B8",width:36,height:36,borderRadius:10,fontSize:18,cursor:"pointer"}}>‹</button>
            <div style={{fontWeight:700,fontSize:15}}>{MONTHS[month]} {year}</div>
            <button onClick={nextMonth} style={{background:"#1E293B",border:"none",color:"#94A3B8",width:36,height:36,borderRadius:10,fontSize:18,cursor:"pointer"}}>›</button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
            {["ALL",...TEAM].map(m=>(
              <button key={m} onClick={()=>setFilterMember(m)} style={{padding:"4px 10px",borderRadius:8,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:filterMember===m?(m==="ALL"?"#3B82F6":memberColor(m)):"#1E293B",color:filterMember===m?"#fff":"#475569"}}>{m}</button>
            ))}
          </div>
          {filteredMonthLeaves.length===0&&<div style={{color:"#334155",textAlign:"center",padding:40,fontSize:14}}>No entries for this month</div>}
          {[...filteredMonthLeaves].sort((a,b)=>a.Start?.localeCompare(b.Start)).map(l=>(
            <div key={l.ID} style={{background:"#111827",borderRadius:14,padding:"12px 14px",marginBottom:10,border:"1px solid #1E293B",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:40,height:40,borderRadius:11,background:memberColor(l.Member)+"33",border:`2px solid ${memberColor(l.Member)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:memberColor(l.Member)}}>{l.Member}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{l.Member}</div>
                  <div style={{fontSize:11,color:"#475569",marginTop:2}}>{l.Start===l.End?l.Start:`${l.Start} → ${l.End}`}</div>
                  <div style={{fontSize:11,color:LEAVE_TYPES[l.Type]?.color,marginTop:2,display:"flex",alignItems:"center",gap:3}}>{LEAVE_TYPES[l.Type]?.icon} {LEAVE_TYPES[l.Type]?.label}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>openEdit(l)} style={{background:"#1E3A5F",border:"none",color:"#93C5FD",padding:"6px 12px",borderRadius:9,fontSize:12,fontWeight:600,cursor:"pointer"}}>Edit</button>
                <button onClick={()=>deleteLeave(l)} style={{background:"#3B1212",border:"none",color:"#FCA5A5",padding:"6px 12px",borderRadius:9,fontSize:12,fontWeight:600,cursor:"pointer"}}>Del</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Export Tab */}
      {!loading && tab==="export" && (
        <div style={{padding:"0 16px",position:"relative",zIndex:1}}>
          <div style={{background:"#111827",borderRadius:16,padding:20,border:"1px solid #1E293B",marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>{MONTHS[month]} {year} Summary</div>
            <div style={{fontSize:13,color:"#475569",marginBottom:16}}>{monthLeaves.length} total entries</div>
            {TEAM.filter(m=>monthLeaves.some(l=>l.Member===m)).map(m=>{
              const ml=monthLeaves.filter(l=>l.Member===m);
              return (
                <div key={m} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1E293B"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:30,height:30,borderRadius:8,background:memberColor(m)+"33",border:`2px solid ${memberColor(m)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:memberColor(m)}}>{m}</div>
                    <span style={{fontSize:13,fontWeight:600}}>{m}</span>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {Object.entries(LEAVE_TYPES).map(([k,v])=>{
                      const c=ml.filter(l=>l.Type===k).length;
                      return c>0?<div key={k} style={{fontSize:11,color:v.color,background:v.color+"22",borderRadius:6,padding:"2px 8px",fontWeight:700}}>{v.icon} {c}</div>:null;
                    })}
                  </div>
                </div>
              );
            })}
            {monthLeaves.length===0&&<div style={{color:"#334155",textAlign:"center",padding:20}}>No leaves this month</div>}
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,background:"#111827",borderRadius:14,padding:"10px 16px",border:"1px solid #1E293B"}}>
            <button onClick={prevMonth} style={{background:"#1E293B",border:"none",color:"#94A3B8",width:34,height:34,borderRadius:9,fontSize:18,cursor:"pointer"}}>‹</button>
            <span style={{fontWeight:600,fontSize:14}}>{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} style={{background:"#1E293B",border:"none",color:"#94A3B8",width:34,height:34,borderRadius:9,fontSize:18,cursor:"pointer"}}>›</button>
          </div>
          <button onClick={exportCSV} style={{width:"100%",padding:"16px",background:"linear-gradient(135deg,#059669,#047857)",border:"none",borderRadius:14,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 8px 24px #05966944"}}>
            📥 Download as Excel / CSV
          </button>
          <div style={{fontSize:11,color:"#334155",textAlign:"center",marginTop:8}}>Opens in Microsoft Excel or Google Sheets</div>
        </div>
      )}

      {/* FAB */}
      <button onClick={openAdd} style={{position:"fixed",bottom:24,right:24,width:58,height:58,borderRadius:18,background:"linear-gradient(135deg,#3B82F6,#6366F1)",border:"none",color:"#fff",fontSize:30,cursor:"pointer",boxShadow:"0 8px 32px #3B82F655",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>+</button>

      {/* Form Modal */}
      {showForm && (
        <div style={{position:"fixed",inset:0,background:"#00000099",display:"flex",alignItems:"flex-end",zIndex:100}} onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div style={{background:"#111827",borderRadius:"22px 22px 0 0",padding:"20px 20px 48px",width:"100%",maxWidth:480,margin:"0 auto",border:"1px solid #1E293B",borderBottom:"none"}}>
            <div style={{width:40,height:4,background:"#1E293B",borderRadius:2,margin:"0 auto 20px"}}/>
            <div style={{fontWeight:800,fontSize:17,marginBottom:18}}>{editLeave?"✏️ Edit Leave":"➕ Log Leave"}</div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:"#475569",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>Team Member</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {TEAM.map(m=>(
                  <button key={m} onClick={()=>setForm(f=>({...f,Member:m}))} style={{padding:"6px 11px",borderRadius:9,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:form.Member===m?memberColor(m)+"44":"#1E293B",color:form.Member===m?memberColor(m):"#475569",outline:form.Member===m?`2px solid ${memberColor(m)}`:"none"}}>{m}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:"#475569",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>Leave Type</div>
              <div style={{display:"flex",gap:8}}>
                {Object.entries(LEAVE_TYPES).map(([k,v])=>(
                  <button key={k} onClick={()=>setForm(f=>({...f,Type:k}))} style={{flex:1,padding:"10px 4px",borderRadius:12,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:form.Type===k?v.color+"33":"#1E293B",color:form.Type===k?v.color:"#334155",outline:form.Type===k?`2px solid ${v.color}`:"none"}}>{v.icon}<br/><span style={{fontSize:10}}>{v.label}</span></button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:20}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:"#475569",marginBottom:6,letterSpacing:1,textTransform:"uppercase"}}>Start Date</div>
                <input type="date" value={form.Start} onChange={e=>setForm(f=>({...f,Start:e.target.value}))} style={{width:"100%",background:"#0A0F1E",border:"1px solid #1E293B",borderRadius:11,padding:"11px 12px",color:"#F1F5F9",fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:"#475569",marginBottom:6,letterSpacing:1,textTransform:"uppercase"}}>End Date</div>
                <input type="date" value={form.End} onChange={e=>setForm(f=>({...f,End:e.target.value}))} style={{width:"100%",background:"#0A0F1E",border:"1px solid #1E293B",borderRadius:11,padding:"11px 12px",color:"#F1F5F9",fontSize:13,boxSizing:"border-box"}}/>
              </div>
            </div>
            {error&&<div style={{background:"#3B1212",border:"1px solid #991B1B",borderRadius:10,padding:"8px 12px",fontSize:12,color:"#FCA5A5",marginBottom:12}}>{error}</div>}
            <button onClick={saveLeave} disabled={saving} style={{width:"100%",padding:"15px",background:saving?"#1E293B":"linear-gradient(135deg,#3B82F6,#6366F1)",border:"none",borderRadius:13,color:"#fff",fontWeight:800,fontSize:15,cursor:saving?"not-allowed":"pointer"}}>
              {saving?"Saving...":editLeave?"Save Changes":"Log Leave"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
