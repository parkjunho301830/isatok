/**
 * Firebase 초기화 및 공통 함수 (members.html, tournament.html)
 *
 * 섹션 구성:
 *  1. Firebase 설정 및 초기화
 *  2. 인증
 *  3. Firestore CRUD 헬퍼
 *  4. 네비게이션
 */

// ─────────────────────────────────────────
// 1. Firebase 설정 및 초기화
// ─────────────────────────────────────────

// Firebase 설정
const firebaseConfig = {
    // 여기에 Firebase 프로젝트 설정을 입력하세요
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// Firebase 서비스 초기화
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// ─────────────────────────────────────────
// 2. 인증
// ─────────────────────────────────────────

/**
 * 현재 로그인한 사용자 정보 가져오기
 */
function getCurrentUser() {
    return auth.currentUser;
}

/**
 * 로그인 상태 감시
 */
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("사용자 로그인됨:", user.email);
        document.dispatchEvent(new CustomEvent('userLoggedIn', { detail: user }));
    } else {
        console.log("사용자 로그아웃됨");
        document.dispatchEvent(new CustomEvent('userLoggedOut'));
    }
});

// ─────────────────────────────────────────
// 3. Firestore CRUD 헬퍼
// ─────────────────────────────────────────

/**
 * Firestore에서 데이터 가져오기
 * @param {string} collection - 컬렉션 이름
 * @param {object} query - 쿼리 조건 (선택사항)
 */
async function getDocuments(collection, queryConditions = null) {
    try {
        let query = db.collection(collection);
        
        if (queryConditions) {
            Object.keys(queryConditions).forEach(key => {
                query = query.where(key, '==', queryConditions[key]);
            });
        }
        
        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("데이터 가져오기 오류:", error);
        return [];
    }
}

/**
 * Firestore에 데이터 추가
 * @param {string} collection - 컬렉션 이름
 * @param {object} data - 추가할 데이터
 */
async function addDocument(collection, data) {
    try {
        const docRef = await db.collection(collection).add({
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return docRef.id;
    } catch (error) {
        console.error("데이터 추가 오류:", error);
        return null;
    }
}

/**
 * Firestore 데이터 업데이트
 * @param {string} collection - 컬렉션 이름
 * @param {string} docId - 문서 ID
 * @param {object} data - 업데이트할 데이터
 */
async function updateDocument(collection, docId, data) {
    try {
        await db.collection(collection).doc(docId).update({
            ...data,
            updatedAt: new Date()
        });
        return true;
    } catch (error) {
        console.error("데이터 업데이트 오류:", error);
        return false;
    }
}

/**
 * Firestore 데이터 삭제
 * @param {string} collection - 컬렉션 이름
 * @param {string} docId - 문서 ID
 */
async function deleteDocument(collection, docId) {
    try {
        await db.collection(collection).doc(docId).delete();
        return true;
    } catch (error) {
        console.error("데이터 삭제 오류:", error);
        return false;
    }
}

// ─────────────────────────────────────────
// 4. 네비게이션
// ─────────────────────────────────────────

/**
 * 네비게이션 메뉴 렌더링
 */
function renderNavigation() {
    const navElement = document.getElementById('navigation');
    if (!navElement) return;

    const navHTML = `
        <div class="nav-container">
            <div class="nav-logo">이사탁</div>
            <ul class="nav-menu">
                <li><a href="index.html">홈</a></li>
                <li><a href="tournament.html">대회</a></li>
                <li><a href="members.html">회원</a></li>
                <li><a href="notice.html">공지사항</a></li>
                <li><a href="board.html">게시판</a></li>
            </ul>
            <div class="nav-user">
                <span id="user-name">로그인</span>
            </div>
        </div>
    `;
    
    navElement.innerHTML = navHTML;
}

// 페이지 로드 시 네비게이션 렌더링
document.addEventListener('DOMContentLoaded', () => {
    renderNavigation();
});
