/**
 * 대회 관련 기능 (tournament.html)
 * - 대회 목록 조회
 * - 대회 신청
 * - 대회 관리 (수정, 삭제)
 */

const TOURNAMENT_COLLECTION = 'tournaments';

// ─────────────────────────────────────────
// 렌더링
// ─────────────────────────────────────────

/**
 * 대회 목록 렌더링
 */
async function renderTournaments() {
    const container = document.getElementById('tournament-container');
    if (!container) return;

    try {
        const tournaments = await getDocuments(TOURNAMENT_COLLECTION);
        
        if (tournaments.length === 0) {
            container.innerHTML = '<p>진행 중인 대회가 없습니다.</p>';
            return;
        }

        const tournamentsHTML = tournaments.map(tournament => `
            <div class="tournament-card">
                <h3>${tournament.title}</h3>
                <p>일시: ${tournament.date}</p>
                <p>장소: ${tournament.location}</p>
                <p>신청자: ${tournament.participants ? tournament.participants.length : 0}명</p>
                <p>상세: ${tournament.description}</p>
                <div class="tournament-actions">
                    <button onclick="joinTournament('${tournament.id}')">신청</button>
                    <button onclick="editTournament('${tournament.id}')">수정</button>
                    <button onclick="deleteTournament('${tournament.id}')">삭제</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="tournaments-list">
                ${tournamentsHTML}
            </div>
        `;
    } catch (error) {
        console.error("대회 목록 렌더링 오류:", error);
        container.innerHTML = '<p>대회 목록을 불러올 수 없습니다.</p>';
    }
}

// ─────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────

/**
 * 대회 추가
 */
async function addTournament(tournamentData) {
    try {
        const docId = await addDocument(TOURNAMENT_COLLECTION, {
            ...tournamentData,
            participants: []
        });
        if (docId) {
            console.log("대회가 추가되었습니다.");
            renderTournaments();
            return docId;
        }
    } catch (error) {
        console.error("대회 추가 오류:", error);
    }
    return null;
}

/**
 * 대회에 신청
 */
async function joinTournament(tournamentId) {
    const user = getCurrentUser();
    if (!user) {
        alert("로그인이 필요합니다.");
        return;
    }

    try {
        const tournament = await db.collection(TOURNAMENT_COLLECTION).doc(tournamentId).get();
        if (!tournament.exists) {
            console.error("대회를 찾을 수 없습니다.");
            return;
        }

        const data = tournament.data();
        const participants = data.participants || [];
        
        if (participants.includes(user.uid)) {
            alert("이미 신청한 대회입니다.");
            return;
        }

        participants.push(user.uid);
        await updateDocument(TOURNAMENT_COLLECTION, tournamentId, {
            participants: participants
        });

        console.log("대회에 신청되었습니다.");
        renderTournaments();
    } catch (error) {
        console.error("대회 신청 오류:", error);
    }
}

/**
 * 대회 정보 수정
 */
async function editTournament(tournamentId) {
    try {
        const tournament = await db.collection(TOURNAMENT_COLLECTION).doc(tournamentId).get();
        if (!tournament.exists) {
            console.error("대회를 찾을 수 없습니다.");
            return;
        }

        const data = tournament.data();
        const newTitle = prompt("새로운 제목:", data.title);
        if (newTitle === null) return;

        const newDate = prompt("새로운 일시:", data.date);
        if (newDate === null) return;

        await updateDocument(TOURNAMENT_COLLECTION, tournamentId, {
            title: newTitle,
            date: newDate
        });

        console.log("대회 정보가 수정되었습니다.");
        renderTournaments();
    } catch (error) {
        console.error("대회 정보 수정 오류:", error);
    }
}

/**
 * 대회 삭제
 */
async function deleteTournament(tournamentId) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
        await deleteDocument(TOURNAMENT_COLLECTION, tournamentId);
        console.log("대회가 삭제되었습니다.");
        renderTournaments();
    } catch (error) {
        console.error("대회 삭제 오류:", error);
    }
}

// 페이지 로드 시 대회 목록 렌더링
document.addEventListener('DOMContentLoaded', () => {
    renderTournaments();
});
