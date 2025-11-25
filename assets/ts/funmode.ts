import { _decorator, Component, director, Node, Prefab, instantiate, Vec3, UITransform, RichText, AudioClip, AudioSource, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

// 棋子类型枚举
enum PieceType {
    EMPTY = 0,
    BLACK = 1,  // 黑子（玩家1）
    WHITE = 2,  // 白子（玩家2）
    RED = 3     // 红子（障碍棋子）
}

// 游戏状态枚举
enum GameState {
    PLAYING = 0,
    PLAYER1_WIN = 1,
    PLAYER2_WIN = 2,
    DRAW = 3
}

@ccclass('funmode')
export class funmode extends Component {
    @property(Prefab)
    blackPrefab: Prefab = null;

    @property(Prefab)
    whitePrefab: Prefab = null;

    @property(Prefab)
    redPrefab: Prefab = null;

    @property(Node)
    boardNode: Node = null;

    @property(RichText)
    statusText: RichText = null;

    @property(AudioClip)
    placePieceAudio: AudioClip = null;

    @property(AudioClip)
    buttonClickAudio: AudioClip = null;

    @property(AudioClip)
    victoryAudio: AudioClip = null;

    @property(AudioClip)
    defeatAudio: AudioClip = null;

    @property(Node)
    skillButton1: Node = null;  // 玩家1的技能按钮

    @property(Node)
    skillButton2: Node = null;  // 玩家2的技能按钮

    @property(Node)
    skillButton3: Node = null;  // 玩家1的技能2按钮

    @property(Node)
    skillButton4: Node = null;  // 玩家2的技能2按钮

    @property(Node)
    skillButton5: Node = null;  // 玩家1的技能3按钮

    @property(Node)
    skillButton6: Node = null;  // 玩家2的技能3按钮

    @property(Sprite)
    skillButton1Sprite: Sprite = null;  // 玩家1技能1的Sprite

    @property(Sprite)
    skillButton2Sprite: Sprite = null;  // 玩家2技能1的Sprite

    @property(Sprite)
    skillButton3Sprite: Sprite = null;  // 玩家1技能2的Sprite

    @property(Sprite)
    skillButton4Sprite: Sprite = null;  // 玩家2技能2的Sprite

    @property(Sprite)
    skillButton5Sprite: Sprite = null;  // 玩家1技能3的Sprite

    @property(Sprite)
    skillButton6Sprite: Sprite = null;  // 玩家2技能3的Sprite

    @property(SpriteFrame)
    skillAvailableFrame: SpriteFrame = null;  // 技能可用状态的SpriteFrame

    @property(SpriteFrame)
    skillUsedFrame: SpriteFrame = null;  // 技能已使用状态的SpriteFrame

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

    // 技能相关
    private player1SkillUsed: boolean = false;  // 玩家1技能是否已使用
    private player2SkillUsed: boolean = false;  // 玩家2技能是否已使用
    private player1Skill2Used: boolean = false;  // 玩家1技能2是否已使用
    private player2Skill2Used: boolean = false;  // 玩家2技能2是否已使用
    private player1Skill3Used: boolean = false;  // 玩家1技能3是否已使用
    private player2Skill3Used: boolean = false;  // 玩家2技能3是否已使用
    private skillUsedThisTurn: boolean = false;  // 本回合是否已使用技能
    private displaySkillActive: boolean = false;  // 显示技能是否激活
    private originalBoard: number[][] = [];  // 保存原始棋盘状态

    start() {
        // 初始化音频源
        this.initAudioSource();
        
        this.initGame();
        this.setupBoardClick();
        this.setupSkillButtons();
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

    // 播放胜利音效
    private playVictorySound() {
        if (this.audioSource && this.victoryAudio) {
            this.audioSource.playOneShot(this.victoryAudio);
        }
    }

    // 播放失败音效
    private playDefeatSound() {
        if (this.audioSource && this.defeatAudio) {
            this.audioSource.playOneShot(this.defeatAudio);
        }
    }

    // 设置技能按钮
    private setupSkillButtons() {
        // 初始化技能按钮状态
        this.updateSkillButtons();
    }

    // 更新技能按钮状态
    private updateSkillButtons() {
        // 技能按钮始终显示，不再根据当前玩家切换
        if (this.skillButton1) {
            this.skillButton1.active = true;
        }
        // 更新技能1按钮颜色
        if (this.skillButton1Sprite) {
            const isUsed = this.player1SkillUsed;
            const targetFrame = isUsed ? this.skillUsedFrame : this.skillAvailableFrame;
            if (targetFrame) {
                this.skillButton1Sprite.spriteFrame = targetFrame;
            }
        }

        // 技能按钮始终显示，不再根据当前玩家切换
        if (this.skillButton2) {
            this.skillButton2.active = true;
        }
        // 更新技能2按钮颜色
        if (this.skillButton2Sprite) {
            const isUsed = this.player2SkillUsed;
            const targetFrame = isUsed ? this.skillUsedFrame : this.skillAvailableFrame;
            if (targetFrame) {
                this.skillButton2Sprite.spriteFrame = targetFrame;
            }
        }

        // 技能按钮始终显示，不再根据当前玩家切换
        if (this.skillButton3) {
            this.skillButton3.active = true;
        }
        // 更新技能3按钮颜色
        if (this.skillButton3Sprite) {
            const isUsed = this.player1Skill2Used;
            const targetFrame = isUsed ? this.skillUsedFrame : this.skillAvailableFrame;
            if (targetFrame) {
                this.skillButton3Sprite.spriteFrame = targetFrame;
            }
        }

        // 技能按钮始终显示，不再根据当前玩家切换
        if (this.skillButton4) {
            this.skillButton4.active = true;
        }
        // 更新技能4按钮颜色
        if (this.skillButton4Sprite) {
            const isUsed = this.player2Skill2Used;
            const targetFrame = isUsed ? this.skillUsedFrame : this.skillAvailableFrame;
            if (targetFrame) {
                this.skillButton4Sprite.spriteFrame = targetFrame;
            }
        }

        // 技能按钮始终显示，不再根据当前玩家切换
        if (this.skillButton5) {
            this.skillButton5.active = true;
        }
        // 更新技能5按钮颜色
        if (this.skillButton5Sprite) {
            const isUsed = this.player1Skill3Used;
            const targetFrame = isUsed ? this.skillUsedFrame : this.skillAvailableFrame;
            if (targetFrame) {
                this.skillButton5Sprite.spriteFrame = targetFrame;
            }
        }

        // 技能按钮始终显示，不再根据当前玩家切换
        if (this.skillButton6) {
            this.skillButton6.active = true;
        }
        // 更新技能6按钮颜色
        if (this.skillButton6Sprite) {
            const isUsed = this.player2Skill3Used;
            const targetFrame = isUsed ? this.skillUsedFrame : this.skillAvailableFrame;
            if (targetFrame) {
                this.skillButton6Sprite.spriteFrame = targetFrame;
            }
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
        this.player1SkillUsed = false;  // 重置技能状态
        this.player2SkillUsed = false;  // 重置技能状态
        this.player1Skill2Used = false;  // 重置技能2状态
        this.player2Skill2Used = false;  // 重置技能2状态
        this.player1Skill3Used = false;  // 重置技能3状态
        this.player2Skill3Used = false;  // 重置技能3状态
        this.skillUsedThisTurn = false;
        this.displaySkillActive = false;  // 重置显示技能状态
        this.updateStatusText('开始游戏');
        this.updateSkillButtons();
    }

    // 设置棋盘点击事件
    private setupBoardClick() {
        if (this.boardNode) {
            this.boardNode.on(Node.EventType.TOUCH_START, this.onBoardClick, this);
        }
    }

    // 棋盘点击事件处理
    private onBoardClick(event: any) {
        if (this.gameState !== GameState.PLAYING) {
            return;
        }

        const touchPos = event.getUILocation();
        const localPos = this.boardNode.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));
        
        // 转换为棋盘坐标
        const boardX = Math.round((localPos.x - this.BOARD_OFFSET) / this.CELL_SIZE);
        const boardY = Math.round((localPos.y - this.BOARD_OFFSET) / this.CELL_SIZE);

        // 检查坐标是否有效
        // 注意：需要检查原始棋盘数据，因为显示技能期间所有棋子看起来都是当前玩家的颜色
        let isEmpty = false;
        if (this.displaySkillActive) {
            // 显示技能激活时，检查原始棋盘数据
            isEmpty = this.originalBoard[boardY][boardX] === PieceType.EMPTY;
        } else {
            // 正常情况下，检查当前棋盘数据
            isEmpty = this.board[boardY][boardX] === PieceType.EMPTY;
        }

        if (this.isValidPosition(boardX, boardY) && isEmpty) {
            this.placePiece(boardX, boardY, this.currentPlayer);
            
            // 检查当前玩家是否获胜
            if (this.checkWin(boardX, boardY, this.currentPlayer)) {
                // 如果显示技能激活，先恢复显示
                if (this.displaySkillActive) {
                    this.restoreOriginalDisplay();
                    this.displaySkillActive = false;
                }
                
                if (this.currentPlayer === PieceType.BLACK) {
                    this.gameState = GameState.PLAYER1_WIN;
                    this.updateStatusText('黑子获胜！');
                    this.playVictorySound();
                } else {
                    this.gameState = GameState.PLAYER2_WIN;
                    this.updateStatusText('白子获胜！');
                    this.playVictorySound();
                }
                return;
            }

            // 检查平局
            if (this.checkDraw()) {
                this.gameState = GameState.DRAW;
                this.updateStatusText('平局！');
                return;
            }

            // 切换玩家
            this.currentPlayer = this.currentPlayer === PieceType.BLACK ? PieceType.WHITE : PieceType.BLACK;
            this.skillUsedThisTurn = false;  // 重置回合技能使用状态
            
            // 检查是否需要恢复棋盘显示
            if (this.displaySkillActive) {
                this.restoreOriginalDisplay();
                this.displaySkillActive = false;
            }
            
            this.updateSkillButtons();
            const playerName = this.currentPlayer === PieceType.BLACK ? '黑子' : '白子';
            const pieceName = this.currentPlayer === PieceType.BLACK ? '' : '';
            this.updateStatusText(` ${playerName}回合${pieceName}`);
        }
    }

    // 落子
    private placePiece(x: number, y: number, pieceType: PieceType): boolean {
        if (!this.isValidPosition(x, y)) {
            return false;
        }

        // 检查位置是否为空（需要考虑显示技能的影响）
        let isEmpty = false;
        if (this.displaySkillActive) {
            // 显示技能激活时，检查原始棋盘数据
            isEmpty = this.originalBoard[y][x] === PieceType.EMPTY;
        } else {
            // 正常情况下，检查当前棋盘数据
            isEmpty = this.board[y][x] === PieceType.EMPTY;
        }

        if (!isEmpty) {
            return false;
        }

        // 更新棋盘数据（如果显示技能激活，同时更新原始数据）
        if (this.displaySkillActive) {
            this.originalBoard[y][x] = pieceType;
        }
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
            
            // 落子后更新技能按钮状态
            this.skillUsedThisTurn = true;
            this.updateSkillButtons();
        }

        return true;
    }

    // 检查获胜条件
    private checkWin(x: number, y: number, pieceType: PieceType): boolean {
        // 红色棋子不能获胜
        if (pieceType === PieceType.RED) {
            return false;
        }

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
                // 只有空位才能继续下棋，红色棋子占据位置但不算空位
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

    // 玩家1使用技能
    onPlayer1SkillClick() {
        if (this.currentPlayer !== PieceType.BLACK || this.player1SkillUsed || this.skillUsedThisTurn || this.gameState !== GameState.PLAYING) {
            return;
        }

        console.log('玩家1使用技能：扭转乾坤');
        this.playButtonClickSound();
        this.useSwapSkill();
    }

    // 玩家2使用技能
    onPlayer2SkillClick() {
        if (this.currentPlayer !== PieceType.WHITE || this.player2SkillUsed || this.skillUsedThisTurn || this.gameState !== GameState.PLAYING) {
            return;
        }

        console.log('玩家2使用技能：扭转乾坤');
        this.playButtonClickSound();
        this.useSwapSkill();
    }

    // 玩家1使用技能2（显示技能）
    onPlayer1Skill2Click() {
        if (this.currentPlayer !== PieceType.BLACK || this.player1Skill2Used || this.skillUsedThisTurn || this.gameState !== GameState.PLAYING) {
            return;
        }

        console.log('玩家1使用技能2：蒙蔽双眼');
        this.playButtonClickSound();
        this.useDisplaySkill();
    }

    // 玩家2使用技能2（显示技能）
    onPlayer2Skill2Click() {
        if (this.currentPlayer !== PieceType.WHITE || this.player2Skill2Used || this.skillUsedThisTurn || this.gameState !== GameState.PLAYING) {
            return;
        }

        console.log('玩家2使用技能2：蒙蔽双眼');
        this.playButtonClickSound();
        this.useDisplaySkill();
    }

    // 玩家1使用技能3（红化技能）
    onPlayer1Skill3Click() {
        if (this.currentPlayer !== PieceType.BLACK || this.player1Skill3Used || this.skillUsedThisTurn || this.gameState !== GameState.PLAYING) {
            return;
        }

        console.log('玩家1使用技能3：封印术');
        this.playButtonClickSound();
        this.useRedSkill();
    }

    // 玩家2使用技能3（红化技能）
    onPlayer2Skill3Click() {
        if (this.currentPlayer !== PieceType.WHITE || this.player2Skill3Used || this.skillUsedThisTurn || this.gameState !== GameState.PLAYING) {
            return;
        }

        console.log('玩家2使用技能3：封印术');
        this.playButtonClickSound();
        this.useRedSkill();
    }

    // 使用互换技能
    private useSwapSkill() {
        // 标记技能已使用
        if (this.currentPlayer === PieceType.BLACK) {
            this.player1SkillUsed = true;
        } else {
            this.player2SkillUsed = true;
        }

        // 执行棋子互换
        this.swapPieces();

        // 切换到另一个玩家
        this.currentPlayer = this.currentPlayer === PieceType.BLACK ? PieceType.WHITE : PieceType.BLACK;

        // 更新UI
        const playerName = this.currentPlayer === PieceType.BLACK ? '黑子' : '白子';
        this.updateStatusText(`扭转乾坤！${playerName}回合`);
        this.updateSkillButtons();
    }

    // 使用显示技能
    private useDisplaySkill() {
        // 标记技能已使用
        if (this.currentPlayer === PieceType.BLACK) {
            this.player1Skill2Used = true;
        } else {
            this.player2Skill2Used = true;
        }

        // 保存当前棋盘状态
        this.saveOriginalBoard();
        
        // 设置显示技能为激活状态
        this.displaySkillActive = true;

        // 执行显示效果
        this.showOnlyCurrentPlayerPieces();

        // 切换到另一个玩家
        this.currentPlayer = this.currentPlayer === PieceType.BLACK ? PieceType.WHITE : PieceType.BLACK;

        // 更新UI
        const playerName = this.currentPlayer === PieceType.BLACK ? '黑子' : '白子';
        this.updateStatusText(`蒙蔽双眼！${playerName}回合`);
        this.updateSkillButtons();
    }

    // 使用红化技能
    private useRedSkill() {
        // 标记技能已使用
        if (this.currentPlayer === PieceType.BLACK) {
            this.player1Skill3Used = true;
        } else {
            this.player2Skill3Used = true;
        }

        // 执行棋子红化
        this.redPieces();

        // 切换到另一个玩家
        this.currentPlayer = this.currentPlayer === PieceType.BLACK ? PieceType.WHITE : PieceType.BLACK;

        // 更新UI
        const playerName = this.currentPlayer === PieceType.BLACK ? '黑子' : '白子';
        this.updateStatusText(`封印术！${playerName}回合`);
        this.updateSkillButtons();
    }

    // 保存原始棋盘状态
    private saveOriginalBoard() {
        this.originalBoard = [];
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            this.originalBoard[y] = [];
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                this.originalBoard[y][x] = this.board[y][x];
            }
        }
    }

    // 只显示当前玩家的棋子（所有棋子都显示为当前玩家的颜色）
    private showOnlyCurrentPlayerPieces() {
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                // 销毁原有棋子
                if (this.pieces[y][x]) {
                    this.pieces[y][x].destroy();
                    this.pieces[y][x] = null;
                }

                // 如果该位置有棋子（不管是黑子还是白子），都显示为当前玩家的颜色
                if (this.board[y][x] !== PieceType.EMPTY) {
                    const prefab = this.currentPlayer === PieceType.BLACK ? this.blackPrefab : this.whitePrefab;
                    if (prefab) {
                        const pieceNode = instantiate(prefab);
                        const worldPos = this.boardToWorldPosition(x, y);
                        pieceNode.setPosition(worldPos);
                        this.boardNode.addChild(pieceNode);
                        this.pieces[y][x] = pieceNode;
                    }
                }
            }
        }
    }

    // 恢复原始显示
    private restoreOriginalDisplay() {
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                // 销毁现有棋子
                if (this.pieces[y][x]) {
                    this.pieces[y][x].destroy();
                    this.pieces[y][x] = null;
                }

                // 恢复原始棋子显示
                if (this.originalBoard[y][x] !== PieceType.EMPTY) {
                    const prefab = this.originalBoard[y][x] === PieceType.BLACK ? this.blackPrefab : this.whitePrefab;
                    if (prefab) {
                        const pieceNode = instantiate(prefab);
                        const worldPos = this.boardToWorldPosition(x, y);
                        pieceNode.setPosition(worldPos);
                        this.boardNode.addChild(pieceNode);
                        this.pieces[y][x] = pieceNode;
                    }
                }
            }
        }
    }

    // 棋子互换实现
    private swapPieces() {
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                if (this.board[y][x] === PieceType.BLACK) {
                    this.board[y][x] = PieceType.WHITE;
                    // 更新棋子预制体
                    if (this.pieces[y][x] && this.whitePrefab) {
                        this.pieces[y][x].destroy();
                        const newPiece = instantiate(this.whitePrefab);
                        const worldPos = this.boardToWorldPosition(x, y);
                        newPiece.setPosition(worldPos);
                        this.boardNode.addChild(newPiece);
                        this.pieces[y][x] = newPiece;
                    }
                } else if (this.board[y][x] === PieceType.WHITE) {
                    this.board[y][x] = PieceType.BLACK;
                    // 更新棋子预制体
                    if (this.pieces[y][x] && this.blackPrefab) {
                        this.pieces[y][x].destroy();
                        const newPiece = instantiate(this.blackPrefab);
                        const worldPos = this.boardToWorldPosition(x, y);
                        newPiece.setPosition(worldPos);
                        this.boardNode.addChild(newPiece);
                        this.pieces[y][x] = newPiece;
                    }
                }
            }
        }
    }

    // 棋子红化实现
    private redPieces() {
        for (let y = 0; y < this.BOARD_SIZE; y++) {
            for (let x = 0; x < this.BOARD_SIZE; x++) {
                if (this.board[y][x] === PieceType.BLACK || this.board[y][x] === PieceType.WHITE) {
                    this.board[y][x] = PieceType.RED;
                    // 更新棋子预制体为红色
                    if (this.pieces[y][x] && this.redPrefab) {
                        this.pieces[y][x].destroy();
                        const newPiece = instantiate(this.redPrefab);
                        const worldPos = this.boardToWorldPosition(x, y);
                        newPiece.setPosition(worldPos);
                        this.boardNode.addChild(newPiece);
                        this.pieces[y][x] = newPiece;
                    }
                }
            }
        }
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
        // 播放按钮音效
        this.playButtonClickSound();
        
        // 清理资源后再跳转
        this.cleanupBeforeSceneChange();
        
        this.loadScene('home');
    }

    // 场景切换前的清理工作
    private cleanupBeforeSceneChange() {
        // 清理事件监听
        if (this.boardNode && this.boardNode.isValid) {
            this.boardNode.off(Node.EventType.TOUCH_START, this.onBoardClick, this);
        }
        
        // 清理所有定时器
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


