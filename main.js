const STATE_INIT = 3000;
const STATE_READY = 3001;
const STATE_END = 3002;

const startPoint = [6, 6];

const STONE_NONE = 0; // 아무돌도 없는 상태
const STONE_BLACK = 1; // 흑돌 상태
const STONE_WHITE = 2; // 백돌 상태

const BOARD_SIZE = 19;

let _board;
let _board_stack;

let _userMainWidget = [];
let _start = false;
let _timer = 0;
let _playerCount = 0;
let _turn = "";

let blackStone = App.loadSpritesheet("blackStone.png");
let whiteStone = App.loadSpritesheet("whiteStone.png");
App.onJoinPlayer.Add(function (p) {
	if (p.storage == null) {
		p.storage = JSON.stringify({
			exp: 0,
			mainWidget: null,
		});
		p.save();
	}
	p.attackSprite = null;
	p.moveSpeed = 80;
	p.sprite = null;
	p.hidden = false;
	p.tag = {
		joined: false,
		color: "no color",
	};
	p.sendUpdated();
});

App.onLeavePlayer.Add(function (p) {
	if (p.tag.joined == true) {
		_playerCount--;
		// 게임 끝 이벤트 추가해야함
	}
});

App.onSay.add(function (player, text) {
	if (text == "참가") {
		if (_start == true) {
			player.showCenterLabel("이미 게임이 진행중 입니다.");
		}
	}

	if (_state == STATE_INIT) {
		if (text == "참가") {
			if (_playerCount < 2) {
				if (player.tag.joined == false) {
					_playerCount++;
					player.title = "흑돌";
					player.tag.joined = true;
					player.sendUpdated();
					App.playSound("joinSound.m4a");
				}

				if (_playerCount === 2) {
					App.showCenterLabel("참가 마감.", 0xffffff, 0x000000, 300);
					// startState(STATE_READY);
				}
			}
		}
	}
});

let apiRequestDelay = 15;
App.onUpdate.Add(function (dt) {
	// modumeta서버로 플레이어 카운트 보내기
	// if (apiRequestDelay > 0) {
	// 	apiRequestDelay -= dt;
	// 	if (apiRequestDelay < 1) {
	// 		apiRequestDelay = 30;
	// 		App.httpGet(
	// 			"https://api.metabusstation.shop/api/v1/posts/zep/playercount?hashId=" +
	// 				App.mapHashID +
	// 				"&playerCount=" +
	// 				App.playerCount,
	// 			{},
	// 			(a) => {}
	// 		);
	// 	}
	// }

	if (_stateTimer > 0) {
		_stateTimer -= dt;
		if (_state != STATE_READY && _tickTockSoundOn == false) {
			if (_stateTimer < 9) {
				_tickTockSoundOn = true;
				App.playSound("tickTockSound.mp3");
			}
		}
	}
});

// x 를 누르면 이벤트
App.addOnKeyDown(88, function (player) {
	if (player.tag.joined === true) {
		let x = player.tileX;
		let y = player.tileY;
		// 이 좌표에 돌이 놓여있는지 검사하는 코드 필요.
		// 돌이 안놓여있다면, 돌을 놓은 위치를 배열에 저장?
		if (player.tag.color === _turn) {
			Map.putObject(x, y, whiteStone);
			_turn = "black";
		} else if (player.tag.color === _turn) {
			Map.putObject(x, y, blackStone);
			_turn = "white";
		}
	}
});

function startState(state) {
	_state = state;
	_stateTimer = 0;
	_tickTockSoundOn = false;

	switch (_state) {
		case STATE_INIT:
			_start = false;
			Map.clearAllObjects();
			_board = new Array();
			_board_stack = new Array();

			for (let i = 0; i < BOARD_SIZE; i++) {
				_board[i] = new Array();
				for (let j = 0; j < BOARD_SIZE; j++) {
					_board[i][j] = STONE_NONE;
				}
			}
			break;
		case STATE_READY:
			_stateTimer = 10;
			_start = true;
			_turn = "black";
			// 참가하지 않은 플레이어 바둑판 밖으로 내보내기
			// 바둑판 테두리부분 impassable 타일로 감싸기
			break;
	}
}
