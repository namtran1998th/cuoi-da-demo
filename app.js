const seed = [
 {id:'cat',author:'Mèo hướng nội',avatar:'M',color:'green',time:'2 giờ trước',topic:'Mèo & đồng bọn',title:'Tôi lúc 8:00 sáng sau khi hứa sẽ ngủ sớm từ tối qua',image:'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1000&q=85',top:'TỐI QUA: NGỦ SỚM CHO KHỎE',bottom:'SÁNG NAY: MÌNH LÀ AI? ĐÂY LÀ ĐÂU?',likes:1286,comments:[{name:'Louis không vui',text:'Mở mắt là một chuyện, tỉnh dậy là một chuyện khác :))'}],score:100},
 {id:'work',author:'Louis không vui',avatar:'L',color:'',time:'3 giờ trước',topic:'Chuyện đi làm',title:'Sếp: “Em cứ làm thoải mái, không có áp lực gì đâu.”',image:'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1000&q=85',top:'CŨNG LÀ TÔI',bottom:'SAU 5 PHÚT ĐI LÀM THOẢI MÁI',likes:964,comments:[{name:'Trà đá vỉa hè',text:'Thoải mái làm từ sáng đến tối luôn ạ.'}],score:95},
 {id:'life',author:'Trà đá vỉa hè',avatar:'T',color:'pink',time:'5 giờ trước',topic:'Đời thường',title:'Kế hoạch cuối tuần của người trưởng thành: rất nhiều dự định.',image:'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1000&q=85',top:'DỰ ĐỊNH THÌ NHIỀU',bottom:'NHƯNG CÁI GIƯỜNG KHÔNG CHO PHÉP',likes:1578,comments:[{name:'Mèo hướng nội',text:'Kế hoạch hoàn hảo: không có kế hoạch.'}],score:90},
 {id:'school',author:'Bút chì không ngòi',avatar:'B',color:'green',time:'6 giờ trước',topic:'Học đường',title:'Khi đề thi có đúng câu mình vừa bỏ qua lúc ôn bài',image:'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=1000&q=85',top:'CÂU NÀY CHẮC KHÔNG THI ĐÂU',bottom:'ĐỀ THI: CHÀO NGƯỜI QUEN',likes:728,comments:[],score:80}
];
const key='cuoi-da-demo-v1';
let state={likes:[],saved:[],comments:{},posts:[]};
try{const stored=JSON.parse(localStorage.getItem(key));if(stored&&Array.isArray(stored.likes)&&Array.isArray(stored.saved)&&Array.isArray(stored.posts)&&stored.comments&&typeof stored.comments==='object')state=stored;}catch{}
let tab='hot',topic='',query='',openComments=new Set();
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',3200)}
function persist(){try{localStorage.setItem(key,JSON.stringify(state));return true}catch{toast('Bộ nhớ trình duyệt đã đầy hoặc bị chặn. Thay đổi chỉ giữ trong phiên này.');return false}}
let mediaPosts=[];
function allPosts(){return [...mediaPosts,...state.posts,...seed]}
function count(p){return p.likes+(state.likes.includes(p.id)?1:0)}
function render(){let posts=allPosts().filter(p=>(!topic||p.topic===topic)&&(!query||`${p.title} ${p.author} ${p.topic}`.toLocaleLowerCase('vi').includes(query))&&(tab!=='saved'||state.saved.includes(p.id)));if(tab==='top')posts.sort((a,b)=>count(b)-count(a));if(tab==='hot')posts.sort((a,b)=>b.score-a.score);
 const titles={hot:'Đang hot',new:'Mới tinh',top:'Top tiếng cười',saved:'Đã lưu'};$('#feed-title').textContent=topic||titles[tab];$('#feed-description').textContent=tab==='saved'?'Giữ lại những chiếc meme hợp gu bạn.':'Những chiếc meme đang làm cả nhà cười.';$('#result-count').textContent=`${posts.length} bài viết`;
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.classList.toggle('selected',b.dataset.tab===tab);b.setAttribute('aria-pressed',String(b.dataset.tab===tab))});document.querySelectorAll('[data-topic]').forEach(b=>b.classList.toggle('active',b.dataset.topic===topic));
 $('#feed').innerHTML=posts.length?posts.map(p=>{const comments=[...p.comments,...(state.comments[p.id]||[])],liked=state.likes.includes(p.id),saved=state.saved.includes(p.id);return `<article class="post" id="post-${esc(p.id)}"><div class="post-head"><div class="author"><span class="avatar ${esc(p.color)}">${esc(p.avatar)}</span><strong>${esc(p.author)}</strong><span>· ${esc(p.time)}</span><span class="category">${esc(p.topic)}</span></div><h3>${esc(p.title)}</h3></div><div class="meme ${p.user?'user':''}">${p.kind==='video'?`<video src="${esc(p.image)}" controls playsinline preload="metadata" aria-label="${esc(p.title)}"></video>`:`<img src="${esc(p.image)}" alt="${esc(p.title)}" ${p.id==='cat'?'fetchpriority="high"':'loading="lazy"'}>`}<div class="meme-top">${esc(p.top||'')}</div><div class="meme-bottom">${esc(p.bottom||'')}</div></div><div class="post-actions"><button class="${liked?'liked':''}" data-action="like" data-id="${esc(p.id)}" aria-pressed="${liked}" aria-label="Thích bài viết">↑ <b>${count(p).toLocaleString('vi')}</b></button><button data-action="comment" data-id="${esc(p.id)}" aria-expanded="${openComments.has(p.id)}">♧ ${comments.length} bình luận</button><button class="save ${saved?'saved':''}" data-action="save" data-id="${esc(p.id)}" aria-label="${saved?'Bỏ lưu':'Lưu'} bài viết" aria-pressed="${saved}">▱</button><button class="share" data-action="share" data-id="${esc(p.id)}" aria-label="Chia sẻ bài viết">↗</button></div>${openComments.has(p.id)?`<div class="comments">${comments.length?comments.map(c=>`<div class="comment"><strong>${esc(c.name)}</strong>${esc(c.text)}</div>`).join(''):'<p class="demo-caption">Mở hàng bằng một bình luận vui nào!</p>'}<form class="comment-form" data-id="${esc(p.id)}"><input name="comment" maxlength="500" required aria-label="Viết bình luận" placeholder="Nói gì đó vui vui…"><button>Gửi</button></form></div>`:`<div class="post-foot">${comments.length?`<b>${esc(comments[0].name)}</b> &nbsp; ${esc(comments[0].text)}`:'Chiếc meme này đang chờ bình luận đầu tiên của bạn.'}</div>`}</article>`}).join(''):'<div class="empty">Chưa có bài viết ở đây.<br>Thử tìm từ khác hoặc lưu một chiếc meme bạn thích nhé.</div>';
}
document.addEventListener('click',async e=>{const btn=e.target.closest('button');if(!btn)return;if(btn.dataset.tab){tab=btn.dataset.tab;topic='';render()}if(btn.dataset.topic){topic=topic===btn.dataset.topic?'':btn.dataset.topic;tab='hot';render()}if(btn.dataset.action){const {action,id}=btn.dataset;if(action==='like'||action==='save'){const list=action==='like'?state.likes:state.saved;const i=list.indexOf(id);if(i>=0)list.splice(i,1);else list.push(id);persist();render()}if(action==='comment'){openComments.has(id)?openComments.delete(id):openComments.add(id);render();document.querySelector(`#post-${CSS.escape(id)} input`)?.focus()}if(action==='share')openShare(id)}});
$('#search').addEventListener('input',e=>{query=e.target.value.trim().toLocaleLowerCase('vi');render()});
$('#feed').addEventListener('submit',e=>{e.preventDefault();const form=e.target,text=form.elements.comment.value.trim();if(!text)return;const id=form.dataset.id;(state.comments[id]??=[]).push({name:'Bạn',text});persist();render();document.querySelector(`#post-${CSS.escape(id)} input`)?.focus()});

// Blobs and their post metadata commit together; video never goes into localStorage.
const mediaDB=new Promise((resolve,reject)=>{
 const request=indexedDB.open('cuoi-da-media',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('posts',{keyPath:'id'});
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error);
 request.onblocked=()=>reject(new Error('Storage blocked'));
});
async function saveMedia(post){const db=await mediaDB;await new Promise((resolve,reject)=>{const tx=db.transaction('posts','readwrite');tx.objectStore('posts').put(post);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error)})}
function displayMedia(post){return {...post,image:URL.createObjectURL(post.file)}}
const mediaReady=mediaDB.then(db=>new Promise((resolve,reject)=>{const r=db.transaction('posts').objectStore('posts').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})).then(posts=>{mediaPosts=posts.sort((a,b)=>b.created-a.created).map(displayMedia);render()}).catch(()=>toast('Không mở được bộ nhớ ảnh/video. Vui lòng cho phép lưu dữ liệu trang web.'));

const dialog=$('#upload-dialog'),form=$('#post-form'),submit=form.querySelector('[type=submit]');
let selectedFile=null,previewURL='',selection=0,busy=false;
function resetPreview(){selection++;selectedFile=null;submit.disabled=true;$('#preview').hidden=true;const video=$('#video-preview');video.pause();video.removeAttribute('src');video.load();video.hidden=true;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=''}
function openUpload(){dialog.showModal()}$('#upload').onclick=openUpload;$('#join-upload').onclick=openUpload;dialog.querySelector('.close').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{if(!busy){resetPreview();form.reset();$('#upload-error').textContent=''}});
form.elements.image.addEventListener('change',()=>{
 resetPreview();$('#upload-error').textContent='';const file=form.elements.image.files[0];if(!file)return;
 const video=['video/mp4','video/webm'].includes(file.type),image=['image/png','image/jpeg','image/webp','image/gif'].includes(file.type);
 if((!video&&!image)||file.size===0||file.size>(video?50:2)*1024*1024){$('#upload-error').textContent='Chọn ảnh hợp lệ tối đa 2 MB hoặc video MP4/WebM tối đa 50 MB.';return}
 const version=selection;previewURL=URL.createObjectURL(file);const preview=video?$('#video-preview'):$('#preview');
 const ready=()=>{if(version!==selection)return;selectedFile=file;submit.disabled=false;preview.hidden=false};
 preview.onerror=()=>{if(version!==selection)return;$('#upload-error').textContent='Không đọc được tệp này. Hãy chọn ảnh hợp lệ hoặc video MP4/WebM mà trình duyệt hỗ trợ.';selectedFile=null;submit.disabled=true;preview.hidden=true};
 if(video){preview.onloadeddata=ready;preview.preload='auto'}else preview.onload=ready;
 preview.src=previewURL;
});
submit.disabled=true;
form.addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;const title=form.elements.title.value.trim();if(!title||!selectedFile){$('#upload-error').textContent='Nhập tiêu đề và chờ ảnh/video xem trước tải xong.';return}
 busy=true;submit.disabled=true;submit.textContent='Đang lưu…';
 const post={id:'u'+crypto.randomUUID(),created:Date.now(),author:'Bạn',avatar:'B',color:'',time:'Vừa xong',topic:form.elements.topic.value,title,file:selectedFile,kind:selectedFile.type.startsWith('video/')?'video':'image',likes:0,comments:[],score:0,user:true};
 try{await mediaReady;await saveMedia(post);mediaPosts.unshift(displayMedia(post));busy=false;dialog.close();tab='new';topic='';query='';$('#search').value='';render();window.scrollTo({top:0,behavior:'smooth'});toast('Đã lưu bài đăng trên trình duyệt của bạn.')}
 catch{ $('#upload-error').textContent='Không lưu được tệp. Bộ nhớ có thể đã đầy hoặc bị chặn. Hãy chọn tệp nhỏ hơn hoặc kiểm tra quyền lưu trữ.' }
 finally{busy=false;submit.disabled=!selectedFile;submit.textContent='Đăng bài thử ↗'}
});
const shareDialog=$('#share-dialog');let shareData;
function openShare(id){const post=allPosts().find(p=>p.id===id);if(!post)return;shareData={title:post.title,url:location.href.split('#')[0]+(post.user?'':'#post-'+id)};$('#share-link').value=shareData.url;$('#share-note').textContent=post.user?'Bài này chỉ lưu trong trình duyệt của bạn. Liên kết dưới đây chia sẻ trang demo, không chứa ảnh/video vừa đăng.':'Liên kết mở bài mẫu trong bản demo. Trang hiện riêng tư, người nhận cần có quyền truy cập.';$('#native-share').hidden=typeof navigator.share!=='function';shareDialog.showModal()}
shareDialog.querySelector('.close').onclick=()=>shareDialog.close();
$('#copy-share').onclick=async()=>{try{await navigator.clipboard.writeText(shareData.url);toast('Đã sao chép liên kết.')}catch{$('#share-link').focus();$('#share-link').select();toast('Hãy sao chép liên kết trong ô đã chọn.')}};
$('#native-share').onclick=async()=>{try{await navigator.share(shareData)}catch(e){if(e.name!=='AbortError')toast('Chưa chia sẻ được. Bạn có thể sao chép liên kết.')}};
render();mediaReady.then(()=>{if(location.hash)document.getElementById(location.hash.slice(1))?.scrollIntoView()});
