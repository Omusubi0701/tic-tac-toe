const cells = document.querySelectorAll('.cell');
const turnInfo = document.getElementById('turn-info');
const status = document.getElementById('status');
const signalOut = document.getElementById('signal-out');
const signalIn = document.getElementById('signal-in');
const boardDiv = document.getElementById('board');
const copyBtn = document.getElementById('copy-signal');
const restartBtn = document.getElementById('restart-btn');

const playerIdInput = document.getElementById('player-id');
const setIdBtn = document.getElementById('set-id-btn');
const connectionArea = document.getElementById('connection-area');

let localConnection;
let dataChannel;
let playerSymbol = '';
let isMyTurn = false;
let board = Array(9).fill('');
let playerId = '';

// --- ID設定機能 ---
setIdBtn.addEventListener('click', () => {
    const val = playerIdInput.value.trim();
    if (!val) {
        alert('IDを入力してください');
        return;
    }
    playerId = val;
    playerIdInput.disabled = true;
    setIdBtn.disabled = true;
    connectionArea.style.display = 'block';
    status.textContent = `あなたのID: ${playerId} - 接続を開始してください`;
});

// --- WebRTC関係 ---
const createPeerConnection = () => {
    localConnection = new RTCPeerConnection();

    localConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
    };

    localConnection.onicecandidate = (event) => {
        if (event.candidate === null) {
            const sdp = localConnection.localDescription;
            signalOut.value = JSON.stringify(sdp, null, 2); // 整形表示
        }
    };
};

const setupDataChannel = () => {
    dataChannel.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'move') {
            board[msg.index] = msg.symbol;
            updateBoard();
            isMyTurn = true;
            turnInfo.textContent = 'あなたの番です';
        } else if (msg.type === 'restart') {
            resetGame();
        }
    };

    dataChannel.onopen = () => {
        status.textContent = '✅ 接続成功！ゲーム開始';
        boardDiv.style.display = 'grid';
        restartBtn.style.display = 'inline-block';
        updateBoard();
    };
};

document.getElementById('create-offer').onclick = async () => {
    if (!playerId) {
        alert('先にIDを設定してください');
        return;
    }

    createPeerConnection();
    dataChannel = localConnection.createDataChannel('game');
    setupDataChannel();

    const offer = await localConnection.createOffer();
    await localConnection.setLocalDescription(offer);

    playerSymbol = 'X';
    isMyTurn = true;
    turnInfo.textContent = 'あなたは X（先手）';
    status.textContent = '🔗 相手に接続情報を送ってください';
};

document.getElementById('create-answer').onclick = async () => {
    if (!playerId) {
        alert('先にIDを設定してください');
        return;
    }

    createPeerConnection();
    try {
        const offer = JSON.parse(signalIn.value);
        await localConnection.setRemoteDescription(offer);

        const answer = await localConnection.createAnswer();
        await localConnection.setLocalDescription(answer);

        playerSymbol = 'O';
        isMyTurn = false;
        turnInfo.textContent = 'あなたは O（後手）';
        status.textContent = '✅ 接続情報をホストに送ってください';
    } catch {
        alert('接続情報（SDP）の形式が正しくありません');
    }
};

document.getElementById('set-remote').onclick = async () => {
    try {
        const remoteDesc = JSON.parse(signalIn.value);
        await localConnection.setRemoteDescription(remoteDesc);
        status.textContent = '🔄 接続中...';
    } catch {
        alert('接続情報（SDP）の形式が正しくありません');
    }
};

copyBtn.onclick = () => {
    navigator.clipboard.writeText(signalOut.value).then(() => {
        copyBtn.textContent = '✅ コピーしました！';
        setTimeout(() => (copyBtn.textContent = '📋 コピー'), 2000);
    });
};

// --- リスタート機能 ---
restartBtn.addEventListener('click', () => {
    sendRestart();
});

function sendRestart() {
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'restart' }));
    }
    resetGame();
}

function resetGame() {
    board = Array(9).fill('');
    updateBoard();
    // 先手はX。Xなら自分のターン、Oなら相手のターンからスタート
    isMyTurn = playerSymbol === 'X';
    turnInfo.textContent = isMyTurn ? 'あなたの番です' : '相手の番です';
    status.textContent = '🔄 ゲームをリスタートしました';
}

// --- 三目並べ機能 ---
cells.forEach((cell) => {
    cell.addEventListener('click', () => {
        const index = parseInt(cell.dataset.index);
        if (!isMyTurn || board[index] !== '') return;

        board[index] = playerSymbol;
        updateBoard();
        dataChannel.send(
            JSON.stringify({ type: 'move', index, symbol: playerSymbol })
        );
        isMyTurn = false;
        turnInfo.textContent = '相手の番です';
    });
});

function updateBoard() {
    cells.forEach((cell, i) => {
        cell.textContent = board[i];
    });
}
