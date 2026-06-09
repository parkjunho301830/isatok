/**
 * 공지사항 기능
 * - 공지사항 목록 조회
 * - 공지사항 작성
 * - 공지사항 수정/삭제
 */

const NOTICE_COLLECTION = 'notices';

/**
 * 공지사항 목록 렌더링
 */
async function renderNotices() {
    const container = document.getElementById('notice-container');
    if (!container) return;

    try {
        const notices = await getDocuments(NOTICE_COLLECTION);
        
        if (notices.length === 0) {
            container.innerHTML = '<p>공지사항이 없습니다.</p>';
            return;
        }

        const noticesHTML = notices
            .sort((a, b) => b.createdAt - a.createdAt)
            .map(notice => `
                <div class="notice-item">
                    <h3>${notice.title}</h3>
                    <p class="notice-date">${notice.createdAt ? new Date(notice.createdAt.toDate()).toLocaleDateString() : '미정'}</p>
                    <p class="notice-content">${notice.content}</p>
                    <div class="notice-actions">
                        <button onclick="viewNotice('${notice.id}')">보기</button>
                        <button onclick="editNotice('${notice.id}')">수정</button>
                        <button onclick="deleteNotice('${notice.id}')">삭제</button>
                    </div>
                </div>
            `).join('');

        container.innerHTML = `
            <div class="notices-list">
                <button onclick="showNoticeForm()">공지사항 작성</button>
                ${noticesHTML}
            </div>
        `;
    } catch (error) {
        console.error("공지사항 목록 렌더링 오류:", error);
        container.innerHTML = '<p>공지사항을 불러올 수 없습니다.</p>';
    }
}

/**
 * 공지사항 작성 폼 표시
 */
function showNoticeForm() {
    const title = prompt("제목을 입력하세요:");
    if (title === null) return;

    const content = prompt("내용을 입력하세요:");
    if (content === null) return;

    addNotice({ title, content });
}

/**
 * 공지사항 추가
 */
async function addNotice(noticeData) {
    try {
        const docId = await addDocument(NOTICE_COLLECTION, noticeData);
        if (docId) {
            console.log("공지사항이 등록되었습니다.");
            renderNotices();
            return docId;
        }
    } catch (error) {
        console.error("공지사항 추가 오류:", error);
    }
    return null;
}

/**
 * 공지사항 상세 조회
 */
async function viewNotice(noticeId) {
    try {
        const notice = await db.collection(NOTICE_COLLECTION).doc(noticeId).get();
        if (!notice.exists) {
            console.error("공지사항을 찾을 수 없습니다.");
            return;
        }

        const data = notice.data();
        alert(`${data.title}\n\n${data.content}`);
    } catch (error) {
        console.error("공지사항 조회 오류:", error);
    }
}

/**
 * 공지사항 수정
 */
async function editNotice(noticeId) {
    try {
        const notice = await db.collection(NOTICE_COLLECTION).doc(noticeId).get();
        if (!notice.exists) {
            console.error("공지사항을 찾을 수 없습니다.");
            return;
        }

        const data = notice.data();
        const newTitle = prompt("새로운 제목:", data.title);
        if (newTitle === null) return;

        const newContent = prompt("새로운 내용:", data.content);
        if (newContent === null) return;

        await updateDocument(NOTICE_COLLECTION, noticeId, {
            title: newTitle,
            content: newContent
        });

        console.log("공지사항이 수정되었습니다.");
        renderNotices();
    } catch (error) {
        console.error("공지사항 수정 오류:", error);
    }
}

/**
 * 공지사항 삭제
 */
async function deleteNotice(noticeId) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
        await deleteDocument(NOTICE_COLLECTION, noticeId);
        console.log("공지사항이 삭제되었습니다.");
        renderNotices();
    } catch (error) {
        console.error("공지사항 삭제 오류:", error);
    }
}

// 페이지 로드 시 공지사항 목록 렌더링
document.addEventListener('DOMContentLoaded', () => {
    renderNotices();
});
