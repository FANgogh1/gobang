import { _decorator, Component, Node, Prefab, instantiate, Vec3, UITransform, RichText, AudioClip, AudioSource, director, Label, Button } from 'cc';
import { CloudManager, RoomData } from './CloudManager';

const { ccclass, property } = _decorator;

enum PieceType {
    EMPTY = 0,
    BLACK = 1,
    WHITE = 2
}

enum GameState {
    PLAYING = 0,
    PLAYER1_WIN = 1,
    PLAYER2_WIN = 2,
    DRAW = 3
}

@ccclass('online')
export class online extends Component {
    // UI组件
    @property(RichText)
    statusText: RichText = null;

    @property(Label)
    roomIdLabel: Label = null;

    @property(Button)
    createRoomBtn: Button = null;

    @property(Button)
    joinRoomBtn: Button = null;

    @property(Button)
    matchBtn: Button = null;

    @property(Button)
    restartBtn: Button = null;

    @property(Button)
    returnHomeBtn: Button = null;

    // 游戏组件
    @property(Prefab)
    blackPrefab: Prefab = null;

    @property(Prefab)
    whitePrefab: Prefab = null;

    @property(Node)
    boardNode: Node = null;

    @property(AudioClip)
    placePieceAudio: AudioClip = null;

    @property(AudioClip)
    buttonClickAudio: AudioClip = null;

    private audioSource: AudioSource = null;
    private cloudManager: CloudManager = null;

    // 棋盘配置
    private BOARD_SIZE = 15;
    private CELL_SIZE = 50;
    private BOARD_OFFSET = -350;

    // 游戏数据
    private board: number[][] = [];
    private pieces: Node[][] = [];
    private gameState: GameState = GameState.PLAYING;
    private currentPlayer: PieceType = PieceType.BLACK;

    // 联机数据
    private roomId: string = '';
    private playerId: string = '';
    private playerRole: number = 0; // 1表示房主（黑子），2表示客机（白子）
    private isMyTurn: boolean = false;
    private isShowingDialog: boolean = false; // 防止多次显示输入对话框的标志

    async start() {
        this.initAudioSource();
        
        // 创建CloudManager实例
        const cloudNode = new Node('CloudManager');
        cloudNode.parent = this.node;
        this.cloudManager = cloudNode.addComponent(CloudManager);
        
        // 设置全局实例
        (CloudManager as any).instance = this.cloudManager;
        
        // 初始化云开发
        this.updateStatusText('正在初始化云开发...');
        await this.cloudManager.initCloud();
        
        if (!this.cloudManager.isInitialized()) {
            this.updateStatusText('云开发初始化失败，请检查网络连接');
            console.error('云开发未正确初始化');
            return;
        }

        this.initGame();
        this.setupButtons();
        await this.loginAndSetup();
    }

    update(deltaTime: number) {
        // 更新逻辑
    }

    // 初始化音频源
    private initAudioSource() {
        this.audioSource = this.node.addComponent(AudioSource);
        this.audioSource.volume = 0.8;
        this.audioSource.playOnAwake = false;
    }

    // 播放音效
    private playPlacePieceSound() {
        if (this.audioSource && this.placePieceAudio) {
            this.audioSource.playOneShot(this.placePieceAudio);
        }
    }

    private playButtonClickSound() {
        if (this.audioSource && this.buttonClickAudio) {
            this.audioSource.playOneShot(this.buttonClickAudio);
        }
    }

    // 初始化游戏
    private initGame() {
        this.board = [];
        this.pieces = [];
        for (let i = 0; i < this.BOARD_SIZE; i++) {
            this.board[i] = [];
            this.pieces[i] = [];
            for (let j = 0; j < this.BOARD_SIZE; j++) {
                this.board[i][j] = PieceType.EMPTY;
                this.pieces[i][j] = null;
            }
        }

        this.gameState = GameState.PLAYING;
        this.updateStatusText('请创建房间或加入游戏');
    }

    // 设置按钮事件
    private setupButtons() {
        console.log('设置按钮事件监听器');
        
        // 先移除现有的监听器，防止重复绑定
        if (this.createRoomBtn) {
            this.createRoomBtn.node.off(Button.EventType.CLICK, this.onCreateRoomClick, this);
            this.createRoomBtn.node.on(Button.EventType.CLICK, this.onCreateRoomClick, this);
        }
        if (this.joinRoomBtn) {
            this.joinRoomBtn.node.off(Button.EventType.CLICK, this.onJoinRoomClick, this);
            this.joinRoomBtn.node.on(Button.EventType.CLICK, this.onJoinRoomClick, this);
        }
        if (this.matchBtn) {
            this.matchBtn.node.off(Button.EventType.CLICK, this.onMatchClick, this);
            this.matchBtn.node.on(Button.EventType.CLICK, this.onMatchClick, this);
        }
        if (this.restartBtn) {
            this.restartBtn.node.off(Button.EventType.CLICK, this.onRestartClick, this);
            this.restartBtn.node.on(Button.EventType.CLICK, this.onRestartClick, this);
        }
        if (this.returnHomeBtn) {
            this.returnHomeBtn.node.off(Button.EventType.CLICK, this.onReturnHomeClick, this);
            this.returnHomeBtn.node.on(Button.EventType.CLICK, this.onReturnHomeClick, this);
        }

        if (this.boardNode) {
            this.boardNode.off(Node.EventType.TOUCH_START, this.onBoardClick, this);
            this.boardNode.on(Node.EventType.TOUCH_START, this.onBoardClick, this);
        }
        
        // 添加键盘快捷键用于调试（开发环境）
        if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
            // 避免重复添加键盘监听器
            const existingHandler = (e: KeyboardEvent) => {
                if (e.key === 'F1') {
                    e.preventDefault();
                    this.createTestRoom();
                }
            };
            
            window.removeEventListener('keydown', existingHandler);
            window.addEventListener('keydown', existingHandler);
        }
    }

    // 创建测试房间（用于调试）
    private async createTestRoom() {
        if (!this.cloudManager || !this.playerId) {
            console.error('CloudManager或playerId未初始化');
            return;
        }
        
        try {
            const roomId = 'TEST123';
            console.log('创建测试房间:', roomId);
            
            await this.cloudManager.createRoom(this.playerId, 'TestHost');
            console.log('测试房间创建成功:', roomId);
            this.updateStatusText(`测试房间已创建: ${roomId}`);
        } catch (error) {
            console.error('创建测试房间失败:', error);
        }
    }

    // 登录并设置
    private async loginAndSetup() {
        try {
            this.playerId = await this.cloudManager.login();
            this.updateStatusText('登录成功，请选择创建房间或加入游戏');
        } catch (error) {
            this.updateStatusText('登录失败');
            console.error('登录失败:', error);
        }
    }

    // 创建房间
    private async onCreateRoomClick() {
        // 防止重复创建房间
        if (this.roomId && this.roomId !== '') {
            console.log('已存在房间，跳过重复创建:', this.roomId);
            this.updateStatusText('已存在房间: ' + this.roomId);
            return;
        }
        
        try {
            console.log('开始创建房间...');
            this.playButtonClickSound();
            
            // 禁用按钮，防止重复点击
            if (this.createRoomBtn) {
                this.createRoomBtn.interactable = false;
            }
            
            this.roomId = await this.cloudManager.createRoom(this.playerId, 'Player');
            
            console.log('房间创建成功:', this.roomId);
            
            if (this.roomIdLabel) {
                this.roomIdLabel.string = `房间号: ${this.roomId}`;
            }
            
            this.playerRole = 1; // 房主为黑子
            this.isMyTurn = true;
            
            this.updateStatusText('房间创建成功，等待对手加入...');
            this.startWatchRoom();
        } catch (error) {
            this.updateStatusText('创建房间失败');
            console.error('创建房间失败:', error);
        } finally {
            // 重新启用按钮
            if (this.createRoomBtn) {
                this.createRoomBtn.interactable = true;
            }
        }
    }

    // 加入房间
    private async onJoinRoomClick() {
        // 防止重复点击
        if (this.joinRoomBtn) {
            this.joinRoomBtn.interactable = false;
        }
        
        try {
            // 显示输入房间号的对话框
            const roomId = await this.showRoomInputDialog();
            
            if (!roomId) {
                // 用户取消输入
                return;
            }
            
            this.playButtonClickSound();
            this.updateStatusText('正在加入房间...');
            
            const success = await this.cloudManager.joinRoom(roomId, this.playerId, 'Player');
            
            if (success) {
                this.roomId = roomId;
                this.playerRole = 2; // 客机为白子
                this.isMyTurn = false;
                
                if (this.roomIdLabel) {
                    this.roomIdLabel.string = `房间号: ${roomId}`;
                }
                
                this.updateStatusText('成功加入房间，等待房主落子...');
                this.startWatchRoom();
            }
        } catch (error) {
            this.updateStatusText('加入房间失败: ' + (error.message || '房间不存在'));
            console.error('加入房间失败:', error);
        } finally {
            // 重新启用按钮
            if (this.joinRoomBtn) {
                this.joinRoomBtn.interactable = true;
            }
        }
    }

    // 显示输入房间号的对话框
    private showRoomInputDialog(): Promise<string> {
        // 防止重复显示对话框
        if (this.isShowingDialog) {
            console.log('对话框已在显示中，忽略重复调用');
            return Promise.resolve(null);
        }
        
        this.isShowingDialog = true;
        
        return new Promise((resolve) => {
            try {
                if (typeof window !== 'undefined' && window.wx && window.wx.showModal) {
                    // 使用微信小程序的模态框
                    window.wx.showModal({
                        title: '加入房间',
                        editable: true,
                        placeholderText: '请输入房间号',
                        success: (res) => {
                            this.isShowingDialog = false;
                            if (res.confirm && res.content) {
                                resolve(res.content.trim().toUpperCase());
                            } else {
                                resolve(null);
                            }
                        },
                        fail: () => {
                            this.isShowingDialog = false;
                            resolve(null);
                        }
                    });
                } else {
                    // 非微信环境，使用原生prompt
                    const roomId = prompt('请输入房间号:', '');
                    this.isShowingDialog = false;
                    if (roomId) {
                        resolve(roomId.trim().toUpperCase());
                    } else {
                        resolve(null);
                    }
                }
            } catch (error) {
                console.error('显示输入对话框时发生错误:', error);
                this.isShowingDialog = false;
                resolve(null);
            }
        });
    }

    // 匹配游戏
    private async onMatchClick() {
        try {
            this.playButtonClickSound();
            this.updateStatusText('正在匹配中...');
            
            const room = await this.cloudManager.getRandomRoom();
            if (room) {
                // 找到房间，加入
                console.log('找到可用房间，准备加入:', room.roomId);
                const success = await this.cloudManager.joinRoom(room.roomId, this.playerId, 'Player');
                if (success) {
                    this.roomId = room.roomId;
                    this.playerRole = 2;
                    this.isMyTurn = false;
                    
                    if (this.roomIdLabel) {
                        this.roomIdLabel.string = `房间号: ${room.roomId}`;
                    }
                    
                    this.updateStatusText('匹配成功，等待房主落子...');
                    this.startWatchRoom();
                    
                    // 立即检查一次房间状态
                    setTimeout(async () => {
                        const updatedRoom = await this.cloudManager.getRoom(room.roomId);
                        if (updatedRoom) {
                            console.log('立即检查房间状态:', updatedRoom);
                            this.onRoomUpdate(updatedRoom);
                        }
                    }, 1000);
                }
            } else {
                // 没找到房间，创建新房间
                this.roomId = await this.cloudManager.createRoom(this.playerId, 'Player');
                this.playerRole = 1;
                this.isMyTurn = true;
                
                if (this.roomIdLabel) {
                    this.roomIdLabel.string = `房间号: ${this.roomId}`;
                }
                
                this.updateStatusText('创建房间成功，等待对手加入...');
                this.startWatchRoom();
            }
        } catch (error) {
            this.updateStatusText('匹配失败');
            console.error('匹配失败:', error);
        }
    }

    // 开始监听房间
    private startWatchRoom() {
        if (!this.roomId) return;
        
        console.log('开始监听房间:', this.roomId);
        
        this.cloudManager.watchRoom(this.roomId, (room: RoomData | null) => {
            this.onRoomUpdate(room);
        });
        
        // 定期手动刷新房间状态（作为实时监听的补充）
        this.scheduleRoomRefresh();
    }
    
    // 定期刷新房间状态
    private scheduleRoomRefresh() {
        // 清除之前的定时器
        if (this.roomRefreshTimer) {
            clearInterval(this.roomRefreshTimer);
        }
        
        // 每3秒检查一次房间状态
        this.roomRefreshTimer = setInterval(async () => {
            if (this.roomId) {
                try {
                    const room = await this.cloudManager.getRoom(this.roomId);
                    if (room) {
                        console.log('定期刷新获取到房间状态:', room);
                        this.onRoomUpdate(room);
                    }
                } catch (error) {
                    console.error('定期刷新房间状态失败:', error);
                }
            }
        }, 3000);
    }
    
    private roomRefreshTimer: NodeJS.Timeout | null = null;

    // 房间状态更新
    private onRoomUpdate(room: RoomData | null | undefined) {
        console.log('房间状态更新:', room);
        
        // 检查房间数据是否有效
        if (!room) {
            console.warn('收到空的房间数据，忽略更新');
            return;
        }
        
        // 检查必要的数据字段
        if (!room.gameState || !Array.isArray(room.gameState)) {
            console.warn('房间数据无效，gameState不是数组:', room);
            return;
        }
        
        // 更新棋盘状态（始终更新，包括游戏结束时）
        this.board = room.gameState;
        this.updateBoardDisplay();
        
        // 更新当前玩家
        this.currentPlayer = room.currentPlayer;
        
        // 检查是否轮到自己
        this.isMyTurn = (this.playerRole === 1 && this.currentPlayer === 1) || 
                       (this.playerRole === 2 && this.currentPlayer === 2);
        
        // 更新游戏状态显示
        if (room.gameStatus === 'finished') {
            this.gameState = room.winner === this.playerRole ? GameState.PLAYER1_WIN : GameState.PLAYER2_WIN;
            const winnerText = room.winner === this.playerRole ? '你赢了！' : '你输了！';
            this.updateStatusText(winnerText);
            
            // 确保最终的棋盘状态被正确显示
            console.log('游戏结束，最终棋盘状态已更新');
        } else if (room.gameStatus === 'playing') {
            const myColor = this.playerRole === 1 ? '黑子' : '白子';
            this.updateStatusText(this.isMyTurn ? `轮到你了（${myColor}）` : `等待对手落子`);
        } else if (room.gameStatus === 'waiting') {
            this.updateStatusText('等待对手加入...');
        }
    }

    // 更新棋盘显示
    private updateBoardDisplay() {
        // 检查棋盘数据是否有效
        if (!this.board || !Array.isArray(this.board)) {
            console.warn('棋盘数据无效，无法更新显示');
            return;
        }
        
        console.log('更新棋盘显示，当前棋盘状态:', this.board);
        
        // 清除现有棋子
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            // 确保当前行存在
            if (!this.pieces[y]) {
                this.pieces[y] = [];
            }
            
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                // 确保当前位置存在
                if (!this.pieces[y][x]) {
                    this.pieces[y][x] = null;
                }
                
                // 销毁现有棋子
                if (this.pieces[y][x] && this.pieces[y][x].isValid) {
                    this.pieces[y][x].destroy();
                    this.pieces[y][x] = null;
                }
                
                // 重新创建棋子
                if (this.board[y] && this.board[y][x] !== PieceType.EMPTY) {
                    const prefab = this.board[y][x] === PieceType.BLACK ? this.blackPrefab : this.whitePrefab;
                    if (prefab) {
                        const pieceNode = instantiate(prefab);
                        const worldPos = this.boardToWorldPosition(x, y);
                        pieceNode.setPosition(worldPos);
                        this.boardNode.addChild(pieceNode);
                        this.pieces[y][x] = pieceNode;
                        
                        // 记录创建的棋子，便于调试
                        if (this.board[y][x] === PieceType.BLACK) {
                            console.log(`创建黑子 at (${x}, ${y})`);
                        } else {
                            console.log(`创建白子 at (${x}, ${y})`);
                        }
                    }
                }
            }
        }
        
        console.log('棋盘更新完成，棋子数量统计:', this.countPieces());
    }
    
    // 统计棋子数量（用于调试）
    private countPieces(): { black: number; white: number } {
        let blackCount = 0;
        let whiteCount = 0;
        
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                if (this.board[y] && this.board[y][x] === PieceType.BLACK) {
                    blackCount++;
                } else if (this.board[y] && this.board[y][x] === PieceType.WHITE) {
                    whiteCount++;
                }
            }
        }
        
        return { black: blackCount, white: whiteCount };
    }

    // 棋盘点击事件
    private onBoardClick(event: any) {
        if (!this.isMyTurn || this.gameState !== GameState.PLAYING || !this.roomId) {
            return;
        }

        const touchPos = event.getUILocation();
        const localPos = this.boardNode.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));
        
        const boardX = Math.round((localPos.x - this.BOARD_OFFSET) / this.CELL_SIZE);
        const boardY = Math.round((localPos.y - this.BOARD_OFFSET) / this.CELL_SIZE);

        if (this.isValidPosition(boardX, boardY) && this.board[boardY][boardX] === PieceType.EMPTY) {
            this.placePiece(boardX, boardY);
        }
    }

    // 落子
    private async placePiece(x: number, y: number) {
        this.board[y][x] = this.currentPlayer;
        
        // 创建棋子
        const prefab = this.currentPlayer === PieceType.BLACK ? this.blackPrefab : this.whitePrefab;
        if (prefab) {
            const pieceNode = instantiate(prefab);
            const worldPos = this.boardToWorldPosition(x, y);
            pieceNode.setPosition(worldPos);
            this.boardNode.addChild(pieceNode);
            this.pieces[y][x] = pieceNode;
            
            this.playPlacePieceSound();
        }

        // 先更新游戏状态，确保最后一颗棋子被同步
        const nextPlayer = this.currentPlayer === PieceType.BLACK ? PieceType.WHITE : PieceType.BLACK;
        await this.cloudManager.updateGameState(this.roomId, this.board, nextPlayer);

        // 检查获胜
        if (this.checkWin(x, y, this.currentPlayer)) {
            await this.cloudManager.finishGame(this.roomId, this.playerRole);
            return;
        }

        // 检查平局
        if (this.checkDraw()) {
            await this.cloudManager.finishGame(this.roomId, 0); // 0表示平局
            return;
        }
    }

    // 检查获胜
    private checkWin(x: number, y: number, pieceType: PieceType): boolean {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dx, dy] of directions) {
            let count = 1;

            // 正向检查
            let nx = x + dx;
            let ny = y + dy;
            while (this.isValidPosition(nx, ny) && this.board[ny][nx] === pieceType) {
                count++;
                nx += dx;
                ny += dy;
            }

            // 反向检查
            nx = x - dx;
            ny = y - dy;
            while (this.isValidPosition(nx, ny) && this.board[ny][nx] === pieceType) {
                count++;
                nx -= dx;
                ny -= dy;
            }

            if (count >= 5) {
                return true;
            }
        }

        return false;
    }

    // 检查平局
    private checkDraw(): boolean {
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                if (this.board[y][x] === PieceType.EMPTY) {
                    return false;
                }
            }
        }
        return true;
    }

    // 检查位置有效性
    private isValidPosition(x: number, y: number): boolean {
        return x >= 0 && x < this.BOARD_SIZE && y >= 0 && y < this.BOARD_SIZE;
    }

    // 棋盘坐标转世界坐标
    private boardToWorldPosition(x: number, y: number): Vec3 {
        const worldX = this.BOARD_OFFSET + x * this.CELL_SIZE;
        const worldY = this.BOARD_OFFSET + y * this.CELL_SIZE;
        return new Vec3(worldX, worldY, 0);
    }

    // 更新状态文本
    private updateStatusText(text: string) {
        if (this.statusText) {
            this.statusText.string = text;
        }
    }

    // 重新开始
    private async onRestartClick() {
        this.playButtonClickSound();
        
        // 离开当前房间
        if (this.roomId) {
            await this.cloudManager.leaveRoom(this.roomId, this.playerId);
        }
        
        this.initGame();
        this.roomId = '';
        this.playerRole = 0;
        this.isMyTurn = false;
        
        if (this.roomIdLabel) {
            this.roomIdLabel.string = '';
        }
    }

    // 返回主页
    private onReturnHomeClick() {
        this.playButtonClickSound();
        
        if (this.roomId) {
            this.cloudManager.leaveRoom(this.roomId, this.playerId);
        }
        
        director.loadScene('home');
    }

    onDestroy() {
        console.log('销毁online组件，清理资源');
        
        if (this.roomId) {
            this.cloudManager.leaveRoom(this.roomId, this.playerId);
        }
        
        // 清理定时器
        if (this.roomRefreshTimer) {
            clearInterval(this.roomRefreshTimer);
            this.roomRefreshTimer = null;
        }
        
        // 清理所有事件监听
        if (this.createRoomBtn && this.createRoomBtn.node && this.createRoomBtn.node.isValid) {
            this.createRoomBtn.node.off(Button.EventType.CLICK, this.onCreateRoomClick, this);
        }
        if (this.joinRoomBtn && this.joinRoomBtn.node && this.joinRoomBtn.node.isValid) {
            this.joinRoomBtn.node.off(Button.EventType.CLICK, this.onJoinRoomClick, this);
        }
        if (this.matchBtn && this.matchBtn.node && this.matchBtn.node.isValid) {
            this.matchBtn.node.off(Button.EventType.CLICK, this.onMatchClick, this);
        }
        if (this.restartBtn && this.restartBtn.node && this.restartBtn.node.isValid) {
            this.restartBtn.node.off(Button.EventType.CLICK, this.onRestartClick, this);
        }
        if (this.returnHomeBtn && this.returnHomeBtn.node && this.returnHomeBtn.node.isValid) {
            this.returnHomeBtn.node.off(Button.EventType.CLICK, this.onReturnHomeClick, this);
        }
        if (this.boardNode && this.boardNode.isValid) {
            this.boardNode.off(Node.EventType.TOUCH_START, this.onBoardClick, this);
        }
    }
}