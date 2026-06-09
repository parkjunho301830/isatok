/**
 * 자유게시판 기능
 * - 게시글 목록 조회
 * - 게시글 작성/수정/삭제
 * - 댓글 기능
 */

const BOARD_COLLECTION = 'board_posts';
const COMMENTS_COLLECTION = 'board_comments';

/**
 * 게시글 목록 렌더링
 */
async function renderBoardPosts() {
    const container = document.getElementById('board-container');
    if (!container) return;

    try {
        const posts = await getDocuments(BOARD_COLLECTION);
        
        if (posts.length === 0) {
            container.innerHTML = '<p>작성된 게시글이 없습니다.</p>';
            return;
        }

        const postsHTML = posts
            .sort((a, b) => b.createdAt - a.createdAt)
            .map(post => `
                <div class="board-post">
                    <h3>${post.title}</h3>
                    <p class="post-author">${post.author} | ${post.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString() : '미정'}</p>
                    <p class="post-content">${post.content.substring(0, 200)}...</p>
                    <div class="post-actions">
                        <button onclick="viewPost('${post.id}')">보기</button>
                        <button onclick="editPost('${post.id}')">수정</button>
                        <button onclick="deletePost('${post.id}')">삭제</button>
                    </div>
                </div>
            `).join('');

        container.innerHTML = `
            <div class="posts-list">
                <button onclick="showPostForm()">게시글 작성</button>
                ${postsHTML}
            </div>
        `;
    } catch (error) {
        console.error("게시글 목록 렌더링 오류:", error);
        container.innerHTML = '<p>게시글을 불러올 수 없습니다.</p>';
    }
}

/**
 * 게시글 작성 폼 표시
 */
function showPostForm() {
    const user = getCurrentUser();
    if (!user) {
        alert("로그인이 필요합니다.");
        return;
    }

    const title = prompt("제목을 입력하세요:");
    if (title === null) return;

    const content = prompt("내용을 입력하세요:");
    if (content === null) return;

    addBoardPost({
        title,
        content,
        author: user.email
    });
}

/**
 * 게시글 추가
 */
async function addBoardPost(postData) {
    try {
        const docId = await addDocument(BOARD_COLLECTION, postData);
        if (docId) {
            console.log("게시글이 작성되었습니다.");
            renderBoardPosts();
            return docId;
        }
    } catch (error) {
        console.error("게시글 추가 오류:", error);
    }
    return null;
}

/**
 * 게시글 상세 조회
 */
async function viewPost(postId) {
    try {
        const post = await db.collection(BOARD_COLLECTION).doc(postId).get();
        if (!post.exists) {
            console.error("게시글을 찾을 수 없습니다.");
            return;
        }

        const data = post.data();
        alert(`${data.title}\n\n작성자: ${data.author}\n날짜: ${data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : '미정'}\n\n${data.content}`);
    } catch (error) {
        console.error("게시글 조회 오류:", error);
    }
}

/**
 * 게시글 수정
 */
async function editPost(postId) {
    try {
        const post = await db.collection(BOARD_COLLECTION).doc(postId).get();
        if (!post.exists) {
            console.error("게시글을 찾을 수 없습니다.");
            return;
        }

        const data = post.data();
        const newTitle = prompt("새로운 제목:", data.title);
        if (newTitle === null) return;

        const newContent = prompt("새로운 내용:", data.content);
        if (newContent === null) return;

        await updateDocument(BOARD_COLLECTION, postId, {
            title: newTitle,
            content: newContent
        });

        console.log("게시글이 수정되었습니다.");
        renderBoardPosts();
    } catch (error) {
        console.error("게시글 수정 오류:", error);
    }
}

/**
 * 게시글 삭제
 */
async function deletePost(postId) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
        await deleteDocument(BOARD_COLLECTION, postId);
        console.log("게시글이 삭제되었습니다.");
        renderBoardPosts();
    } catch (error) {
        console.error("게시글 삭제 오류:", error);
    }
}

/**
 * 댓글 추가
 */
async function addComment(postId, commentData) {
    try {
        const docId = await addDocument(COMMENTS_COLLECTION, {
            ...commentData,
            postId: postId
        });
        if (docId) {
            console.log("댓글이 추가되었습니다.");
            return docId;
        }
    } catch (error) {
        console.error("댓글 추가 오류:", error);
    }
    return null;
}

/**
 * 게시글의 댓글 목록 조회
 */
async function getComments(postId) {
    try {
        const comments = await db.collection(COMMENTS_COLLECTION)
            .where('postId', '==', postId)
            .orderBy('createdAt', 'desc')
            .get();
        
        return comments.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("댓글 조회 오류:", error);
        return [];
    }
}

// 페이지 로드 시 게시글 목록 렌더링
document.addEventListener('DOMContentLoaded', () => {
    renderBoardPosts();
});
