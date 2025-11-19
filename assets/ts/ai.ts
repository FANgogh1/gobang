import { _decorator, Component, director, Node, Prefab, instantiate, Vec3, UITransform, Color, Label, RichText, AudioClip, AudioSource } from 'cc';
const { ccclass, property } = _decorator;

// 棋子类型枚举
enum PieceType {
    EMPTY = 0,
    BLACK = 1,  // 玩家黑子
    WHITE = 2   // AI白子
}

// 游戏状态枚举
enum GameState {
    PLAYING = 0,
    PLAYER_WIN = 1,
    AI_WIN = 2,
    DRAW = 3
}

@ccclass('ai')
export class ai extends Component {
    @property(Prefab)
    blackPrefab: Prefab = null;

    @property(Prefab)
    whitePrefab: Prefab = null;

    @property(Node)
    boardNode: Node = null;

    @property(RichText)
    statusText: RichText = null;

    @property(AudioClip)
    placePieceAudio: AudioClip = null;

    @property(AudioClip)
    buttonClickAudio: AudioClip = null;

    private audioSource: AudioSource = null;

    // 棋盘配置
    private BOARD_SIZE = 15;  // 15x15棋盘
    private CELL_SIZE = 50;   // 每个格子大小
    private BOARD_OFFSET = -350; // 棋盘偏移量

    // 游戏数据
    private board: number[][] = [];
    private currentPlayer: PieceType = PieceType.BLACK;
    private gameState: GameState = GameState.PLAYING;
    private pieces: Node[][] = [];

    start() {
        // 初始化音频源
        this.initAudioSource();
        
        this.initGame();
        this.setupBoardClick();
    }

    update(deltaTime: number) {
        // 每帧更新逻辑
    }

    // 初始化音频源
    private initAudioSource() {
        this.audioSource = this.node.addComponent(AudioSource);
        this.audioSource.volume = 0.8; // 设置音量
        this.audioSource.playOnAwake = false;
    }

    // 播放落子音效
    private playPlacePieceSound() {
        if (this.audioSource && this.placePieceAudio) {
            this.audioSource.playOneShot(this.placePieceAudio);
        }
    }

    // 播放按钮点击音效
    private playButtonClickSound() {
        if (this.audioSource && this.buttonClickAudio) {
            this.audioSource.playOneShot(this.buttonClickAudio);
        }
    }

    // 初始化游戏
    private initGame() {
        // 初始化棋盘数据
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

        this.currentPlayer = PieceType.BLACK;
        this.gameState = GameState.PLAYING;
        this.updateStatusText('开始游戏');
    }

    // 设置棋盘点击事件
    private setupBoardClick() {
        if (this.boardNode) {
            this.boardNode.on(Node.EventType.TOUCH_START, this.onBoardClick, this);
        }
    }

    // 棋盘点击事件处理
    private onBoardClick(event: any) {
        if (this.gameState !== GameState.PLAYING || this.currentPlayer !== PieceType.BLACK) {
            return;
        }

        const touchPos = event.getUILocation();
        const localPos = this.boardNode.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));
        
        // 转换为棋盘坐标
        const boardX = Math.round((localPos.x - this.BOARD_OFFSET) / this.CELL_SIZE);
        const boardY = Math.round((localPos.y - this.BOARD_OFFSET) / this.CELL_SIZE);

        // 检查坐标是否有效
        if (this.isValidPosition(boardX, boardY) && this.board[boardY][boardX] === PieceType.EMPTY) {
            this.placePiece(boardX, boardY, PieceType.BLACK);
            
            // 检查玩家是否获胜
            if (this.checkWin(boardX, boardY, PieceType.BLACK)) {
                this.gameState = GameState.PLAYER_WIN;
                this.updateStatusText('玩家获胜！');
                return;
            }

            // 检查平局
            if (this.checkDraw()) {
                this.gameState = GameState.DRAW;
                this.updateStatusText('平局！');
                return;
            }

            // 切换到AI回合
            this.currentPlayer = PieceType.WHITE;
            this.updateStatusText('AI思考中...');
            
            // AI延迟响应
            this.scheduleOnce(() => {
                this.aiMove();
            }, 0.5);
        }
    }

    // 落子
    private placePiece(x: number, y: number, pieceType: PieceType): boolean {
        if (!this.isValidPosition(x, y) || this.board[y][x] !== PieceType.EMPTY) {
            return false;
        }

        // 更新棋盘数据
        this.board[y][x] = pieceType;

        // 创建棋子节点
        const prefab = pieceType === PieceType.BLACK ? this.blackPrefab : this.whitePrefab;
        if (prefab) {
            const pieceNode = instantiate(prefab);
            const worldPos = this.boardToWorldPosition(x, y);
            pieceNode.setPosition(worldPos);
            this.boardNode.addChild(pieceNode);
            this.pieces[y][x] = pieceNode;

            // 播放落子音效
            this.playPlacePieceSound();
        }

        return true;
    }

    // AI移动逻辑
    private aiMove() {
        if (this.gameState !== GameState.PLAYING || this.currentPlayer !== PieceType.WHITE) {
            return;
        }

        const move = this.getBestMove();
        if (move) {
            this.placePiece(move.x, move.y, PieceType.WHITE);
            
            // 检查AI是否获胜
            if (this.checkWin(move.x, move.y, PieceType.WHITE)) {
                this.gameState = GameState.AI_WIN;
                this.updateStatusText('AI获胜！');
                return;
            }

            // 检查平局
            if (this.checkDraw()) {
                this.gameState = GameState.DRAW;
                this.updateStatusText('平局！');
                return;
            }

            // 切换到玩家回合
            this.currentPlayer = PieceType.BLACK;
            this.updateStatusText('玩家回合');
        }
    }

    // AI算法：简单的评分系统
    private getBestMove(): { x: number, y: number } | null {
        let bestScore = -Infinity;
        let bestMove: { x: number, y: number } | null = null;

        // 首先检查AI是否能获胜
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                if (this.board[y][x] === PieceType.EMPTY) {
                    this.board[y][x] = PieceType.WHITE;
                    if (this.checkWin(x, y, PieceType.WHITE)) {
                        this.board[y][x] = PieceType.EMPTY;
                        return { x, y };
                    }
                    this.board[y][x] = PieceType.EMPTY;
                }
            }
        }

        // 然后检查是否需要阻止玩家获胜
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                if (this.board[y][x] === PieceType.EMPTY) {
                    this.board[y][x] = PieceType.BLACK;
                    if (this.checkWin(x, y, PieceType.BLACK)) {
                        this.board[y][x] = PieceType.EMPTY;
                        return { x, y };
                    }
                    this.board[y][x] = PieceType.EMPTY;
                }
            }
        }

        // 评估每个位置的分数
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                if (this.board[y][x] === PieceType.EMPTY) {
                    const score = this.evaluatePosition(x, y);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = { x, y };
                    }
                }
            }
        }

        return bestMove;
    }

    // 评估位置分数
    private evaluatePosition(x: number, y: number): number {
        let score = 0;
        
        // 中心位置加分
        const centerX = Math.floor(this.BOARD_SIZE / 2);
        const centerY = Math.floor(this.BOARD_SIZE / 2);
        const distanceFromCenter = Math.abs(x - centerX) + Math.abs(y - centerY);
        score += (this.BOARD_SIZE - distanceFromCenter) * 2;

        // 评估周围棋子的分布
        const directions = [
            [0, 1], [1, 0], [1, 1], [1, -1]
        ];

        for (const [dx, dy] of directions) {
            score += this.evaluateLine(x, y, dx, dy, PieceType.WHITE) * 10;
            score += this.evaluateLine(x, y, dx, dy, PieceType.BLACK) * 8;
        }

        return score;
    }

    // 评估一条线的分数
    private evaluateLine(x: number, y: number, dx: number, dy: number, pieceType: PieceType): number {
        let count = 0;
        let openEnds = 0;

        // 正向检查
        let nx = x + dx;
        let ny = y + dy;
        while (this.isValidPosition(nx, ny) && this.board[ny][nx] === pieceType) {
            count++;
            nx += dx;
            ny += dy;
        }
        if (this.isValidPosition(nx, ny) && this.board[ny][nx] === PieceType.EMPTY) {
            openEnds++;
        }

        // 反向检查
        nx = x - dx;
        ny = y - dy;
        while (this.isValidPosition(nx, ny) && this.board[ny][nx] === pieceType) {
            count++;
            nx -= dx;
            ny -= dy;
        }
        if (this.isValidPosition(nx, ny) && this.board[ny][nx] === PieceType.EMPTY) {
            openEnds++;
        }

        // 根据连子数和开放端返回分数
        if (count >= 4) return 10000;
        if (count === 3 && openEnds === 2) return 5000;
        if (count === 3 && openEnds === 1) return 1000;
        if (count === 2 && openEnds === 2) return 500;
        if (count === 2 && openEnds === 1) return 100;
        if (count === 1 && openEnds === 2) return 50;
        if (count === 1 && openEnds === 1) return 10;
        
        return 1;
    }

    // 检查获胜条件
    private checkWin(x: number, y: number, pieceType: PieceType): boolean {
        const directions = [
            [0, 1], [1, 0], [1, 1], [1, -1]
        ];

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

    // 检查位置是否有效
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

    // 重新开始游戏
    onRestartGame() {
        // 播放按钮音效
        this.playButtonClickSound();
        
        // 清除所有棋子
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                if (this.pieces[y][x]) {
                    this.pieces[y][x].destroy();
                    this.pieces[y][x] = null;
                }
            }
        }
        this.initGame();
    }

    // 返回主页按钮点击事件
    onReturnHomeClick() {
        console.log('返回主页按钮被点击');
        
        // 播放按钮音效
        this.playButtonClickSound();
        
        // 清理资源后再跳转
        this.cleanupBeforeSceneChange();
        
        // 确保场景名称正确，根据项目结构应该是 'home' 或 'c1'
        this.loadScene('home');
    }
    
    // 场景切换前的清理工作
    private cleanupBeforeSceneChange() {
        // 清理事件监听
        if (this.boardNode && this.boardNode.isValid) {
            this.boardNode.off(Node.EventType.TOUCH_START, this.onBoardClick, this);
        }
        
        // 清理定时器
        this.unscheduleAllCallbacks();
        
        // 销毁所有棋子节点
        if (this.pieces) {
            for (let y = 0; y < this.BOARD_SIZE; y++) {
                for (let x = 0; x < this.BOARD_SIZE; x++) {
                    if (this.pieces[y][x] && this.pieces[y][x].isValid) {
                        this.pieces[y][x].destroy();
                        this.pieces[y][x] = null;
                    }
                }
            }
        }
    }

    // 场景跳转方法
    private loadScene(sceneName: string) {
        // 确保在场景跳转前清理资源
        this.cleanupBeforeSceneChange();
        
        // 延迟一帧后跳转，确保清理完成
        this.scheduleOnce(() => {
            director.loadScene(sceneName, (err) => {
                if (err) {
                    console.error(`场景 ${sceneName} 加载失败:`, err);
                } else {
                    console.log(`场景 ${sceneName} 加载成功`);
                }
            });
        }, 0.1);
    }

    onDestroy() {
        // 清理棋盘点击事件监听
        if (this.boardNode && this.boardNode.isValid) {
            this.boardNode.off(Node.EventType.TOUCH_START, this.onBoardClick, this);
        }
        
        // 清理所有定时器
        this.unscheduleAllCallbacks();
        
        // 清理所有棋子
        if (this.pieces) {
            for (let y = 0; y < this.BOARD_SIZE; y++) {
                for (let x = 0; x < this.BOARD_SIZE; x++) {
                    if (this.pieces[y][x] && this.pieces[y][x].isValid) {
                        this.pieces[y][x].destroy();
                        this.pieces[y][x] = null;
                    }
                }
            }
        }
    }
}


