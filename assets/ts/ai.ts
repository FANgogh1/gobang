import { _decorator, Component, director, Node, Prefab, instantiate, Vec3, UITransform, Color, Label, RichText, AudioClip, AudioSource, Sprite } from 'cc';
import { CloudManager } from './CloudManager';
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

    @property(AudioClip)
    victoryAudio: AudioClip = null;

    @property(AudioClip)
    defeatAudio: AudioClip = null;

    private audioSource: AudioSource = null;

    // 排行榜相关
    @property(Node)
    rankNode: Node = null;

    @property(Prefab)
    playerPrefab: Prefab = null;
    
    // 微信云开发
    private cloudManager: CloudManager = null;
    private db: any = null;

    // 棋盘配置
    private BOARD_SIZE = 15;  // 15x15棋盘
    private CELL_SIZE = 50;   // 每个格子大小
    private BOARD_OFFSET = -350; // 棋盘偏移量

    // 游戏数据
    private board: number[][] = [];
    private currentPlayer: PieceType = PieceType.BLACK;
    private gameState: GameState = GameState.PLAYING;
    private pieces: Node[][] = [];
    
    // 悔棋功能：历史记录
    private moveHistory: Array<{ x: number, y: number, pieceType: PieceType }> = [];
    private lastAIMove: { x: number, y: number } | null = null;

    // 排行榜相关
    private rankList: Node[] = [];

    start() {
        // 初始化音频源
        this.initAudioSource();
        
        // 初始化云开发管理器
        this.initCloudManager();
        
        this.initGame();
        this.setupBoardClick();
        this.initRankList();
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

    // 初始化云开发管理器
    private initCloudManager() {
        try {
            // 创建CloudManager实例并初始化
            this.cloudManager = new CloudManager();
            
            // 等待初始化完成
            this.cloudManager.start().then(() => {
                if (this.cloudManager.isInitialized()) {
                    this.db = this.cloudManager['db'];
                    console.log('CloudManager初始化成功');
                } else {
                    console.warn('CloudManager初始化失败，云开发功能将不可用');
                }
            }).catch((error) => {
                console.error('CloudManager初始化失败:', error);
                this.cloudManager = null;
            });
        } catch (error) {
            console.error('CloudManager创建失败:', error);
            this.cloudManager = null;
        }
    }

    // 上传对局记录（通用方法，适用于所有游戏结果）
    private async uploadGameRecord(result: 'win' | 'lose' | 'draw') {
        if (!this.cloudManager || !this.cloudManager.isInitialized() || !this.db) {
            console.log('CloudManager未初始化，跳过记录上传');
            return;
        }

        try {
            // 获取用户信息
            const userInfo = await this.getUserInfo();
            
            // 创建记录数据
            const record = {
                openid: userInfo.openid || 'anonymous',
                nickname: userInfo.nickname || '匿名用户',
                avatarUrl: userInfo.avatarUrl || '',
                winCount: result === 'win' ? 1 : 0,    // 获胜次数
                loseCount: result === 'lose' ? 1 : 0,  // 失败次数
                drawCount: result === 'draw' ? 1 : 0,  // 平局次数
                totalGames: 1,                         // 总对局次数
                lastGameResult: result,                 // 最近游戏结果
                lastGameTime: new Date(),               // 最近游戏时间
                createTime: new Date(),
                lastUpdateTime: new Date()
            };

            console.log('准备上传记录数据:', record);

            // 查询该用户是否已有记录
            const queryResult = await this.db.collection('ai_battle_records')
                .where({
                    openid: record.openid
                })
                .get();

            console.log('查询结果:', queryResult);

            if (queryResult.data && queryResult.data.length > 0) {
                // 更新现有记录
                const existingRecord = queryResult.data[0];
                const updateData: any = {
                    totalGames: (existingRecord.totalGames || 0) + 1,
                    lastGameResult: result,
                    lastGameTime: new Date(),
                    lastUpdateTime: new Date()
                };

                // 根据结果更新对应的计数
                if (result === 'win') {
                    updateData.winCount = (existingRecord.winCount || 0) + 1;
                } else if (result === 'lose') {
                    updateData.loseCount = (existingRecord.loseCount || 0) + 1;
                } else if (result === 'draw') {
                    updateData.drawCount = (existingRecord.drawCount || 0) + 1;
                }

                console.log('更新数据:', updateData);

                await this.db.collection('ai_battle_records')
                    .doc(existingRecord._id)
                    .update({
                        data: updateData
                    });
                
                console.log(`更新对局记录成功，结果: ${result}`);
            } else {
                // 创建新记录
                console.log('创建新记录:', record);
                await this.db.collection('ai_battle_records')
                    .add({
                        data: record
                    });
                console.log(`创建对局记录成功，结果: ${result}`);
            }

            // 根据结果显示不同的提示信息
            const messageMap = {
                'win': '获胜记录已保存！',
                'lose': '对局记录已保存！',
                'draw': '平局记录已保存！'
            };
            this.updateStatusText(messageMap[result]);
            
        } catch (error) {
            console.error('上传对局记录失败:', error);
            this.updateStatusText('记录保存失败，但仍可继续游戏');
        }
    }

    // 上传获胜记录（保留原方法以便兼容，现在调用通用方法）
    private async uploadWinRecord() {
        await this.uploadGameRecord('win');
    }

    // 获取用户信息
    private async getUserInfo(): Promise<{ openid: string, nickname: string, avatarUrl: string }> {
        try {
            // 使用CloudManager的登录方法
            const openid = await this.cloudManager.login();
            const playerInfo = await this.cloudManager.getPlayerInfo(openid);
            
            return {
                openid: openid,
                nickname: playerInfo?.nickname || playerInfo?.nickName || '匿名用户',
                avatarUrl: playerInfo?.avatarUrl || playerInfo?.avatar || ''
            };
        } catch (error) {
            console.log('获取用户信息失败，使用默认值:', error);
            return {
                openid: 'anonymous_' + Date.now(),
                nickname: '匿名用户',
                avatarUrl: ''
            };
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
        
        // 清空历史记录
        this.moveHistory = [];
        this.lastAIMove = null;
        
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
                this.playVictorySound();
                
                // 上传获胜记录
                this.uploadWinRecord();
                
                // 刷新排行榜
                this.initRankList();
                return;
            }

            // 检查平局
            if (this.checkDraw()) {
                this.gameState = GameState.DRAW;
                this.updateStatusText('平局！');
                
                // 上传平局记录
                this.uploadGameRecord('draw');
                
                // 刷新排行榜
                this.initRankList();
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

        // 记录历史
        this.moveHistory.push({ x, y, pieceType });

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
            this.lastAIMove = move;
            
            // 检查AI是否获胜
            if (this.checkWin(move.x, move.y, PieceType.WHITE)) {
                this.gameState = GameState.AI_WIN;
                this.updateStatusText('AI获胜！');
                this.playDefeatSound();
                
                // 上传失败记录
                this.uploadGameRecord('lose');
                
                // 刷新排行榜
                this.initRankList();
                return;
            }

            // 检查平局
            if (this.checkDraw()) {
                this.gameState = GameState.DRAW;
                this.updateStatusText('平局！');
                
                // 上传平局记录
                this.uploadGameRecord('draw');
                
                // 刷新排行榜
                this.initRankList();
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

    // 初始化排行榜
    private async initRankList() {
        console.log('开始初始化排行榜...');
        
        if (!this.rankNode) {
            console.error('排行榜节点未设置');
            return;
        }
        
        if (!this.playerPrefab) {
            console.error('玩家预制体未设置');
            return;
        }

        console.log('排行榜节点和预制体设置正确');

        try {
            // 从云开发获取排行榜数据
            const rankData = await this.getRankData();
            
            console.log('获取到排行榜数据，条数:', rankData.length);
            
            // 清除现有的排行榜项（保留player1）
            this.clearRankList();
            
            // 生成排行榜
            this.createRankList(rankData);
            
            console.log('排行榜初始化完成');
            
        } catch (error) {
            console.error('初始化排行榜失败:', error);
        }
    }

    // 从云开发获取排行榜数据
    private async getRankData(): Promise<Array<{nickname: string, avatarUrl: string, winCount: number}>> {
        if (!this.cloudManager || !this.cloudManager.isInitialized() || !this.db) {
            console.log('CloudManager未初始化，使用模拟数据');
            return this.getMockRankData();
        }

        try {
            console.log('开始获取排行榜数据...');
            const queryResult = await this.db.collection('ai_battle_records')
                .orderBy('winCount', 'desc')
                .limit(10)
                .get();

            console.log('查询结果:', queryResult);

            if (queryResult.data && queryResult.data.length > 0) {
                console.log('获取到数据库数据，条数:', queryResult.data.length);
                const rankData = queryResult.data.map(record => ({
                    nickname: record.nickname || '匿名用户',
                    avatarUrl: record.avatarUrl || '',
                    winCount: record.winCount || 0
                }));
                console.log('处理后的排行榜数据:', rankData);
                return rankData;
            } else {
                console.log('数据库中没有数据，使用模拟数据');
                return this.getMockRankData();
            }
        } catch (error) {
            console.error('获取排行榜数据失败:', error);
            return this.getMockRankData();
        }
    }

    // 模拟排行榜数据
    private getMockRankData(): Array<{nickname: string, avatarUrl: string, winCount: number}> {
        return [
            { nickname: 'AI大师', avatarUrl: '', winCount: 15 },
            { nickname: '围棋高手', avatarUrl: '', winCount: 12 },
            { nickname: '五子棋王', avatarUrl: '', winCount: 10 },
            { nickname: '策略玩家', avatarUrl: '', winCount: 8 },
            { nickname: '新手挑战者', avatarUrl: '', winCount: 5 }
        ];
    }

    // 清除现有的排行榜项（保留player1）
    private clearRankList() {
        // 清除之前动态创建的排行榜项
        for (let i = 1; i < this.rankList.length; i++) {
            if (this.rankList[i] && this.rankList[i].isValid) {
                this.rankList[i].destroy();
            }
        }
        this.rankList = [];
    }

    // 创建排行榜列表
    private createRankList(rankData: Array<{nickname: string, avatarUrl: string, winCount: number}>) {
        if (!this.rankNode || !this.playerPrefab) return;

        console.log('开始创建排行榜，数据条数:', rankData.length);
        console.log('排行榜数据:', rankData);

        // player1节点已经存在于场景中，作为第一名
        const player1Node = this.rankNode.getChildByName('player1');
        if (player1Node) {
            this.rankList[0] = player1Node;
            if (rankData.length > 0) {
                console.log('更新player1节点数据:', rankData[0]);
                this.updatePlayerNode(player1Node, 1, rankData[0]);
            } else {
                console.log('没有数据，使用默认值更新player1');
                this.updatePlayerNode(player1Node, 1, { nickname: '暂无数据', avatarUrl: '', winCount: 0 });
            }
        } else {
            console.error('未找到player1节点');
        }

        // 从第二名开始创建
        const startY = -125; // player1的Y坐标
        const offsetY = -80;  // 每个玩家的间隔

        for (let i = 1; i < Math.min(rankData.length, 10); i++) {
            const playerNode = instantiate(this.playerPrefab);
            const rank = i + 1;
            const y = startY + (i * offsetY);
            
            playerNode.setPosition(10, y, 0);
            this.rankNode.addChild(playerNode);
            this.rankList[i] = playerNode;
            
            console.log(`创建第${rank}名玩家节点:`, rankData[i]);
            this.updatePlayerNode(playerNode, rank, rankData[i]);
        }
    }

    // 更新玩家节点信息
    private updatePlayerNode(playerNode: Node, rank: number, data: {nickname: string, avatarUrl: string, winCount: number}) {
        if (!playerNode) {
            console.error('玩家节点为空');
            return;
        }

        console.log(`更新玩家节点 - 排名:${rank}, 数据:`, data);

        // 更新排名
        const rankLabel = playerNode.getChildByName('rank')?.getComponent(Label);
        if (rankLabel) {
            rankLabel.string = rank.toString();
            console.log(`设置排名: ${rank}`);
        } else {
            console.error('未找到rank标签组件');
        }

        // 更新头像（如果有头像URL，这里可以扩展加载网络图片）
        const avatarSprite = playerNode.getChildByName('avatar')?.getComponent(Sprite);
        if (avatarSprite) {
            if (data.avatarUrl) {
                // 这里可以加载网络头像，暂时使用默认头像
                console.log('设置头像:', data.avatarUrl);
            }
        } else {
            console.error('未找到avatar精灵组件');
        }

        // 更新昵称
        const nicknameLabel = playerNode.getChildByName('nickname')?.getComponent(Label);
        if (nicknameLabel) {
            nicknameLabel.string = data.nickname;
            console.log(`设置昵称: ${data.nickname}`);
        } else {
            console.error('未找到nickname标签组件');
        }

        // 更新获胜次数
        const winCountLabel = playerNode.getChildByName('winCount')?.getComponent(Label);
        if (winCountLabel) {
            winCountLabel.string = data.winCount.toString();
            console.log(`设置获胜次数: ${data.winCount}`);
        } else {
            console.error('未找到winCount标签组件');
        }
    }

    // 悔棋按钮点击事件
    onUndoMove() {
        // 播放按钮音效
        this.playButtonClickSound();
        
        // 检查是否可以悔棋（至少需要一步AI落子和一步玩家落子）
        if (this.moveHistory.length < 2) {
            this.updateStatusText('无法悔棋，步数不足！');
            return;
        }
        
        // 检查当前游戏状态
        if (this.gameState !== GameState.PLAYING) {
            this.updateStatusText('游戏已结束，无法悔棋！');
            return;
        }
        
        // 撤销AI的最近一步落子
        if (this.lastAIMove) {
            this.removePiece(this.lastAIMove.x, this.lastAIMove.y);
            this.moveHistory.pop(); // 移除AI落子记录
        }
        
        // 撤销玩家的最近一步落子
        if (this.moveHistory.length > 0) {
            const lastPlayerMove = this.moveHistory[this.moveHistory.length - 1];
            if (lastPlayerMove.pieceType === PieceType.BLACK) {
                this.removePiece(lastPlayerMove.x, lastPlayerMove.y);
                this.moveHistory.pop(); // 移除玩家落子记录
            }
        }
        
        // 重置相关状态
        this.lastAIMove = null;
        this.currentPlayer = PieceType.BLACK;
        this.updateStatusText('玩家回合');
    }

    // 移除棋子
    private removePiece(x: number, y: number): boolean {
        if (!this.isValidPosition(x, y) || this.board[y][x] === PieceType.EMPTY) {
            return false;
        }

        // 更新棋盘数据
        this.board[y][x] = PieceType.EMPTY;

        // 销毁棋子节点
        if (this.pieces[y][x] && this.pieces[y][x].isValid) {
            this.pieces[y][x].destroy();
            this.pieces[y][x] = null;
        }

        return true;
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

    // 刷新排行榜按钮点击事件
    onRefreshRankClick() {
        console.log('刷新排行榜按钮被点击');
        
        // 播放按钮音效
        this.playButtonClickSound();
        
        // 重新初始化排行榜
        this.initRankList();
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


