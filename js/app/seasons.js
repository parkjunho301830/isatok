/**
 * 시즌 생성·종료·현재 시즌 지정 (관리자)
 */
import { collection, doc, addDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COL_SEASONS } from './constants.js?v=2026.07.07.01';
import { _computeSeasonPoints } from './matchStats.js?v=2026.07.07.01';

let C = null;

export function initSeasons(ctx) {
  C = ctx;
}

function g(id) { return C.g(id); }
function toast(msg) { C.toast(msg); }
function db() { return C.getDb(); }
function seasons() { return C.getSeasons(); }
function members() { return C.getMembers(); }
function isAdmin() { return C.isAdmin(); }
function requireAdmin(fn) { return C.requireAdmin(fn); }
function openMo(id) { return C.openMo(id); }
function closeMo(id) { return C.closeMo(id); }

export function _applySeasonsSnapshotRender(){
  if(C.isScrolling()){C.markPendingSeasonRender();return;}
  if(C.getCurrentPage()==='stats'&&C.isStatsRankingView&&C.isStatsRankingView())C.renderR();
  if(C.getCurrentPage()==='stats'&&C.isStatsClubView&&C.isStatsClubView())C.renderHall();
  var snMo=g('mo-season');
  if(snMo&&snMo.classList.contains('on'))_renderSeasonList();
  C.refreshPlayerProfileIfOpen();
}
export function _updateRkSeasonBar(isSeason,season){
  var bar=g('rk-season-info');
  if(!bar)return;
  if(!isSeason){bar.style.display='none';return;}
  bar.style.display='';
  if(!season){
    bar.innerHTML='<span style="color:var(--amber);font-weight:700">⚠️ 현재 시즌이 없습니다. 📅 시즌 버튼에서 생성해 주세요.</span>';
    return;
  }
  var range=season.startDate+(season.endDate?' ~ '+season.endDate:' ~ 진행중');
  bar.innerHTML='<span style="font-weight:800;color:var(--t1)">📅 '+season.name+'</span>'
    +'<span style="color:var(--t3);font-size:13px;margin-left:8px">'+range+'</span>'
    +(season.status==='ended'&&season.champion?('<span style="margin-left:auto;font-weight:700;color:var(--amber)">👑 '+season.champion.name+'</span>'):'');
}
export function _renderSeasonList(){
  var box=g('sn-list');
  if(!box)return;
  if(!seasons().length){
    box.innerHTML='<div style="text-align:center;padding:16px;color:var(--t3);font-size:13px">등록된 시즌이 없습니다</div>';
    return;
  }
  box.innerHTML=seasons().map(function(s){
    var statusLbl=s.status==='ended'?'종료':'진행중';
    var curTag=s.isCurrent?' <span class="badge bg" style="font-size:11px">현재</span>':'';
    var champ=s.champion&&s.champion.name?(' · 👑 '+s.champion.name):'';
    var acts='';
    if(isAdmin()&&s.status!=='ended'){
      if(!s.isCurrent)acts+='<button class="btn btn-g btn-xs" onclick="setCurrentSeason(\''+s.id+'\')">현재 지정</button> ';
      acts+='<button class="btn btn-d btn-xs" onclick="endSeason(\''+s.id+'\')">시즌 종료</button>';
    }
    return '<div class="season-list-item"><div><div style="font-weight:700;color:var(--t1)">'+s.name+curTag+'</div>'
      +'<div style="font-size:12px;color:var(--t3);margin-top:4px">'+s.startDate+(s.endDate?' ~ '+s.endDate:'')+' · '+statusLbl+champ+'</div></div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+acts+'</div></div>';
  }).join('');
}
window.openSeasonMo=function(){
  requireAdmin(function(){
    var nm=g('sn-name'),st=g('sn-start');
    if(nm&&!nm.value){
      nm.value=new Date().getFullYear()+' 시즌';
    }
    if(st&&!st.value){
      st.value=new Date().toISOString().slice(0,10);
    }
    _renderSeasonList();
    openMo('mo-season');
  });
};
async function _unsetOtherCurrentSeasons(exceptId){
  for(var i=0;i<seasons().length;i++){
    var s=seasons()[i];
    if(s.id!==exceptId&&s.isCurrent){
      if(db())await updateDoc(doc(db(),COL_SEASONS,s.id),{isCurrent:false});
      else s.isCurrent=false;
    }
  }
}
window.createSeason=async function(){
  if(!isAdmin()){toast('⚠️ 관리자만 시즌을 생성할 수 있습니다');return;}
  var name=(g('sn-name')&&g('sn-name').value||'').trim();
  var startDate=(g('sn-start')&&g('sn-start').value||'').trim();
  if(!name||!startDate){toast('⚠️ 시즌 이름과 시작일을 입력해주세요');return;}
  try{
    var data={name:name,startDate:startDate,status:'active',isCurrent:true,createdAt:new Date().toISOString()};
    if(db()){
      await _unsetOtherCurrentSeasons(null);
      await addDoc(collection(db(),COL_SEASONS),data);
    }else{
      await _unsetOtherCurrentSeasons(null);
      seasons().unshift({id:'local_'+Date.now(),...data});
      _applySeasonsSnapshotRender();
    }
    toast('✅ '+name+' 시즌 생성!');
    closeMo('mo-season');
  }catch(e){toast('❌ '+e.message);}
};
window.setCurrentSeason=async function(id){
  if(!isAdmin()){toast('⚠️ 관리자만 시즌을 지정할 수 있습니다');return;}
  try{
    if(db()){
      await _unsetOtherCurrentSeasons(id);
      await updateDoc(doc(db(),COL_SEASONS,id),{isCurrent:true,status:'active'});
    }else{
      await _unsetOtherCurrentSeasons(id);
      var s=seasons().find(function(x){return x.id===id;});
      if(s){s.isCurrent=true;s.status='active';}
      _applySeasonsSnapshotRender();
    }
    toast('✅ 현재 시즌으로 지정했습니다');
  }catch(e){toast('❌ '+e.message);}
};
window.endSeason=async function(id){
  if(!isAdmin()){toast('⚠️ 관리자만 시즌을 종료할 수 있습니다');return;}
  var season=seasons().find(function(s){return s.id===id;});
  if(!season||season.status==='ended'){toast('⚠️ 이미 종료된 시즌입니다');return;}
  if(!confirm(season.name+' 시즌을 종료하시겠습니까?\n시즌 1위에게 👑 시즌 챔피언 배지가 지급됩니다.'))return;
  var endDate=new Date().toISOString().slice(0,10);
  var list=members().filter(function(m){return m.status!=='비활성';})
    .map(function(m){return {m:m,pt:_computeSeasonPoints(m,season,false)};})
    .sort(function(a,b){return b.pt-a.pt||((a.m.name||'').localeCompare(b.m.name||''));});
  var top=list[0];
  var champion=top?{name:top.m.name,memberId:top.m.id,points:top.pt}:null;
  try{
    var upd={status:'ended',isCurrent:false,endDate:endDate,endedAt:new Date().toISOString(),champion:champion};
    if(db()){
      await updateDoc(doc(db(),COL_SEASONS,id),upd);
    }else{
      Object.assign(season,upd);
      _applySeasonsSnapshotRender();
    }
    toast(champion?'🏆 '+season.name+' 종료! 👑 '+champion.name:'✅ '+season.name+' 시즌 종료');
  }catch(e){toast('❌ '+e.message);}
};