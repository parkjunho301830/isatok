/**
 * 회원 관련 기능
 * - 회원 목록 조회
 * - 회원 정보 수정
 * - 회원 검색
 */

const MEMBERS_COLLECTION = 'members';

/**
 * 회원 목록 렌더링
 */
async function renderMembers() {
    const container = document.getElementById('members-container');
    if (!container) return;

    try {
        const members = await getDocuments(MEMBERS_COLLECTION);
        
        if (members.length === 0) {
            container.innerHTML = '<p>등록된 회원이 없습니다.</p>';
            return;
        }

        const membersHTML = members.map(member => `
            <div class="member-card">
                <h3>${member.name}</h3>
                <p>이메일: ${member.email}</p>
                <p>연락처: ${member.phone || '미등록'}</p>
                <p>가입일: ${member.createdAt ? new Date(member.createdAt.toDate()).toLocaleDateString() : '미정'}</p>
                <div class="member-actions">
                    <button onclick="editMember('${member.id}')">수정</button>
                    <button onclick="deleteMember('${member.id}')">삭제</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="members-list">
                ${membersHTML}
            </div>
        `;
    } catch (error) {
        console.error("회원 목록 렌더링 오류:", error);
        container.innerHTML = '<p>회원 목록을 불러올 수 없습니다.</p>';
    }
}

/**
 * 회원 추가
 */
async function addMember(memberData) {
    try {
        const docId = await addDocument(MEMBERS_COLLECTION, memberData);
        if (docId) {
            console.log("회원이 추가되었습니다.");
            renderMembers();
            return docId;
        }
    } catch (error) {
        console.error("회원 추가 오류:", error);
    }
    return null;
}

/**
 * 회원 정보 수정
 */
async function editMember(memberId) {
    try {
        const member = await db.collection(MEMBERS_COLLECTION).doc(memberId).get();
        if (!member.exists) {
            console.error("회원을 찾을 수 없습니다.");
            return;
        }

        const data = member.data();
        const newName = prompt("새로운 이름:", data.name);
        if (newName === null) return;

        const newPhone = prompt("새로운 연락처:", data.phone || '');
        if (newPhone === null) return;

        await updateDocument(MEMBERS_COLLECTION, memberId, {
            name: newName,
            phone: newPhone
        });

        console.log("회원 정보가 수정되었습니다.");
        renderMembers();
    } catch (error) {
        console.error("회원 정보 수정 오류:", error);
    }
}

/**
 * 회원 삭제
 */
async function deleteMember(memberId) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
        await deleteDocument(MEMBERS_COLLECTION, memberId);
        console.log("회원이 삭제되었습니다.");
        renderMembers();
    } catch (error) {
        console.error("회원 삭제 오류:", error);
    }
}

/**
 * 회원 검색
 */
async function searchMembers(searchTerm) {
    const container = document.getElementById('members-container');
    if (!container) return;

    try {
        const allMembers = await getDocuments(MEMBERS_COLLECTION);
        const filtered = allMembers.filter(member =>
            member.name.includes(searchTerm) ||
            member.email.includes(searchTerm)
        );

        if (filtered.length === 0) {
            container.innerHTML = '<p>검색 결과가 없습니다.</p>';
            return;
        }

        const membersHTML = filtered.map(member => `
            <div class="member-card">
                <h3>${member.name}</h3>
                <p>이메일: ${member.email}</p>
                <p>연락처: ${member.phone || '미등록'}</p>
                <div class="member-actions">
                    <button onclick="editMember('${member.id}')">수정</button>
                    <button onclick="deleteMember('${member.id}')">삭제</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="members-list">
                ${membersHTML}
            </div>
        `;
    } catch (error) {
        console.error("회원 검색 오류:", error);
    }
}

// 페이지 로드 시 회원 목록 렌더링
document.addEventListener('DOMContentLoaded', () => {
    renderMembers();
});
