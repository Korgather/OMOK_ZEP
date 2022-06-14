const STATE_INIT = 3000;
const STATE_START = 3001;
const STATE_END = 3002;

const BOARD_SIZE = 19;
const startPoint = [6, 6];

const standLocation = Array.from({ length: BOARD_SIZE * 2 }, (v, k) => {
	let i = startPoint[1];

	if (k >= BOARD_SIZE) {
		return [startPoint[0] + BOARD_SIZE + 1, i + k - BOARD_SIZE];
	} else {
		return [startPoint[0] - 2, i + k];
	}
});

const STONE_NONE = 0; // 아무돌도 없는 상태
const STONE_BLACK = 1; // 흑돌 상태
const STONE_WHITE = 2; // 백돌 상태

let _board;
let _board_stack;

let _stateTimer = 0;
let _state = STATE_INIT;
let _start = false;

let _appWidget;

let _timer = 0;
let _playerCount = 0;
let _turn = "";
let _turnCount = 0;

let blackStone = App.loadSpritesheet("blackStone.png");
let whiteStone = App.loadSpritesheet("whiteStone.png");
let wall = App.loadSpritesheet("wall.png");

let _userMainWidget = [];

App.onPostMessage.Add(function (p, e) {
	App.sayToAll(p.name);
	App.sayToAll(e);
});

App.onEmbedMessage.Add(function (p, e) {
	p.moveSpeed = 80;
	if (e.type === "login") {
		p.name = e.nickname;
		p.tag.id = e.id;
		p.tag.guest = false;
		p.tag.win = e.win;
		p.tag.lose = e.lose;
		p.title = e.win + "승 " + e.lose + "패";
		p.sendUpdated();
	} else if (e.type === "guest") {
		App.httpGet(
			"https://nickname.hwanmoo.kr/?format=json&count=1&max_length=6&whitespace=_",
			null,
			(res) => {
				res = JSON.parse(res);
				p.name = res.words[0];
				p.title = "비로그인 유저";
				p.tag.gusest = true;
				p.tag.win = 0;
				p.tag.lose = 0;
				p.sendUpdated();
			}
		);
		// for (let i in p) {
		// 	App.sayToAll(`${i}: ${p[i]}`);
		// }
	} else if (e.type === "nicknameChange") {
		p.name = e.nickname;
		p.sendUpdated();
	}
});

App.onStart.Add(function () {
	Map.clearAllObjects();
	startState(STATE_INIT);
});

function giveTitle(p) {
	if (p.role == 3000) {
		p.title = "운영자";
	} else if (p.tag.guest) {
		p.title = "비로그인 유저";
	} else if (!p.tag.guest) {
		p.title = p.tag.win + "승 " + p.tag.lose + "패";
	}
	p.sendUpdated();
}

App.onJoinPlayer.Add(function (p) {
	let rand = Math.floor(Math.random() * (BOARD_SIZE * 2));
	if (standLocation[rand]) {
		p.spawnAt(standLocation[rand][0], standLocation[rand][1]);
	}
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
		id: null,
		win: 0,
		lose: 0,
		guest: true,
		joined: false,
		color: "no color",
	};
	// p.moveSpeed = 0;
	p.sendUpdated();
	giveTitle(p);

	if (_state == STATE_INIT) {
		let p_widget = p.showWidget("init.html", "top", 400, 200);
		// p_widget.onMessage.Add(function (player, data) {
		// 	for (let i in data) {
		// 		App.sayToAll(`${i}: ${data[i]}`);
		// 	}
		// 	player.name = data.name;
		// 	player.sendUpdated();
		// });
		_userMainWidget.push(p_widget);
		p_widget.sendMessage({
			total: 2,
			current: _playerCount,
		});
	}
});

App.onLeavePlayer.Add(function (p) {
	if (App.playerCount == 0) {
		App.httpGet(
			"https://api.metabusstation.shop/api/v1/posts/zep/playercount?hashId=" +
				App.mapHashID +
				"&playerCount=" +
				0,
			{},
			(a) => {}
		);
	}

	if (p.tag.joined == true) {
		if (_state == STATE_INIT) {
			_playerCount--;
			p.tag.joined == false;
			sendMessageToPlayerWidget();
		}

		if (_start === true) {
			if (p.tag.color == STONE_BLACK) {
				win_game(STONE_WHITE);
			} else if (p.tag.color == STONE_WHITE) {
				win_game(STONE_BLACK);
			}
			p.tag.lose = p.tag.lose + 1;
			p.sendUpdated();
		}
		// 게임 끝 이벤트 추가해야함
	}

	if (!p.tag.guest) {
		let pwin = p.tag.win * 1;
		let plose = p.tag.lose * 1;
		let pid = p.tag.id * 1;

		App.httpPost(
			"https://api.metabusstation.shop/api/v1/game/omok/user/info",
			{},
			{
				id: p.tag.id + "",
				nickname: p.name + "",
				win: p.tag.win + "",
				lose: p.tag.lose + "",
			},
			(res) => {
				// App.sayToAll(`${res}`);
			}
		);
	}
});

App.onSay.add(function (player, text) {
	if (text == "참가") {
		if (_start == true) {
			player.showCenterLabel(
				"이미 게임이 진행중 입니다.",
				0xffffff,
				0x000000,
				300
			);
		}
	}

	if (_state == STATE_INIT) {
		if (text == "참가") {
			if (_playerCount < 2) {
				if (player.tag.joined == false) {
					_playerCount++;
					App.playSound("joinSound.m4a");
				}
				if (_playerCount == 1) {
					player.tag.joined = true;
					player.tag.color = STONE_BLACK;
					player.title = "⚫흑돌[선]";
					player.sendUpdated();
				} else if (_playerCount == 2) {
					player.tag.joined = true;
					player.tag.color = STONE_WHITE;
					player.title = "⚪백돌";
					player.sendUpdated();
					App.showCenterLabel("게임이 곧 시작됩니다.", 0xffffff, 0x000000, 300);

					App.runLater(() => {
						startState(STATE_START);
					}, 4);
				}
			}
			sendMessageToPlayerWidget();
		}
	}
});

let apiRequestDelay = 15;
App.onUpdate.Add(function (dt) {
	if (apiRequestDelay > 0) {
		apiRequestDelay -= dt;
		if (apiRequestDelay < 1) {
			apiRequestDelay = 30;

			App.httpGet(
				"https://api.metabusstation.shop/api/v1/posts/zep/playercount?hashId=" +
					App.mapHashID +
					"&playerCount=" +
					App.playerCount,
				{},
				(a) => {}
			);
		}
	}

	if (_stateTimer > 0) {
		_stateTimer -= dt;
		if (_state != STATE_INIT && _tickTockSoundOn == false) {
			if (_stateTimer < 9) {
				_tickTockSoundOn = true;
				App.playSound("tickTockSound.mp3");
			}
		}
	}

	if (_stateTimer < 0) {
		if (_state == STATE_START && _start == true) {
			if (_turn == STONE_BLACK) {
				win_game(STONE_WHITE);
			} else if (_turn == STONE_WHITE) {
				win_game(STONE_BLACK);
			}
		}
	}
});

App.addMobileButton(8, 50, 0, function (player) {
	if (_start === true) {
		if (player.tag.joined === true) {
			let x = player.tileX;
			let y = player.tileY;

			let relative_x = x - startPoint[0];
			let relative_y = y - startPoint[1];

			if (relative_x > BOARD_SIZE) relative_x = BOARD_SIZE;
			if (relative_y > BOARD_SIZE) relative_y = BOARD_SIZE;

			// if (relative_x - 1 >= 0) relative_x = relative_x - 1;
			// if (relative_y - 1 >= 0) relative_y = relative_y - 1;

			let playerColor = player.tag.color;

			// App.sayToAll("돌 놓기 테스트1");

			// 이 좌표에 돌이 놓여있는지 검사하는 코드 필요.
			// 돌이 안놓여있다면, 돌을 놓은 위치를 배열에 저장?
			if (playerColor === _turn) {
				// App.sayToAll("돌 놓기 테스트2");
				if (_board[relative_y][relative_x] == STONE_NONE) {
					_board[relative_y][relative_x] = playerColor;

					let result = check_pointer(
						relative_x,
						relative_y,
						playerColor,
						_board
					);

					if (result == null) {
						_board_stack.push([relative_x, relative_y, playerColor]);

						if (playerColor == STONE_WHITE) {
							_tickTockSoundOn = false;
							_stateTimer = 22;
							if (_appWidget) {
								_appWidget.destroy();
								_appWidget = null;
							}
							_appWidget = App.showWidget("black_timer.html", "top", 500, 130);
							Map.putObject(x, y, whiteStone);
							App.playSound("STONE.wav");
						} else if (playerColor == STONE_BLACK) {
							tickTockSoundOn = false;
							_stateTimer = 22;
							if (_appWidget) {
								_appWidget.destroy();
								_appWidget = null;
							}
							_appWidget = App.showWidget("white_timer.html", "top", 500, 130);
							Map.putObject(x, y, blackStone);
							App.playSound("STONE.wav");
						}
						if (_turn === STONE_BLACK) {
							_turn = STONE_WHITE;
						} else if (_turn === STONE_WHITE) {
							_turn = STONE_BLACK;
						}
					} else if (result == false) {
						_board[relative_y][relative_x] = STONE_NONE;
						player.showCenterLabel(
							"금수 입니다. 놓을 수 없습니다.",
							0xffffff,
							0x000000,
							300
						);
					} else if (result == true) {
						_board_stack.push([relative_x, relative_y, playerColor]);

						if (playerColor == STONE_WHITE) {
							Map.putObject(x, y, whiteStone);
							App.playSound("STONE.wav");
						} else if (playerColor == STONE_BLACK) {
							Map.putObject(x, y, blackStone);
							App.playSound("STONE.wav");
						}
						if (_turn === STONE_BLACK) {
							win_game(STONE_BLACK);
						} else if (_turn === STONE_WHITE) {
							win_game(STONE_WHITE);
						}
					}
				} else {
					player.showCenterLabel(
						"둘 수 없는 자리입니다.",
						0xffffff,
						0x000000,
						300
					);
				}
			} else {
				player.showCenterLabel("차례가 아닙니다.", 0xffffff, 0x000000, 300);
			}
		}
	}
});

// x 를 누르면 이벤트
App.addOnKeyDown(88, function (player) {
	if (_start === true) {
		if (player.tag.joined === true) {
			let x = player.tileX;
			let y = player.tileY;

			let relative_x = x - startPoint[0];
			let relative_y = y - startPoint[1];

			if (relative_x > BOARD_SIZE) relative_x = BOARD_SIZE;
			if (relative_y > BOARD_SIZE) relative_y = BOARD_SIZE;

			// if (relative_x - 1 >= 0) relative_x = relative_x - 1;
			// if (relative_y - 1 >= 0) relative_y = relative_y - 1;

			let playerColor = player.tag.color;

			// App.sayToAll("돌 놓기 테스트1");

			// 이 좌표에 돌이 놓여있는지 검사하는 코드 필요.
			// 돌이 안놓여있다면, 돌을 놓은 위치를 배열에 저장?
			if (playerColor === _turn) {
				// App.sayToAll("돌 놓기 테스트2");
				if (_board[relative_y][relative_x] == STONE_NONE) {
					_board[relative_y][relative_x] = playerColor;

					let result = check_pointer(
						relative_x,
						relative_y,
						playerColor,
						_board
					);

					if (result == null) {
						_board_stack.push([relative_x, relative_y, playerColor]);

						if (playerColor == STONE_WHITE) {
							_tickTockSoundOn = false;
							_stateTimer = 22;
							if (_appWidget) {
								_appWidget.destroy();
								_appWidget = null;
							}
							_appWidget = App.showWidget("black_timer.html", "top", 500, 130);
							Map.putObject(x, y, whiteStone);
							_turnCount++;
							App.playSound("STONE.wav");
						} else if (playerColor == STONE_BLACK) {
							tickTockSoundOn = false;
							_stateTimer = 22;
							if (_appWidget) {
								_appWidget.destroy();
								_appWidget = null;
							}
							_appWidget = App.showWidget("white_timer.html", "top", 500, 130);
							Map.putObject(x, y, blackStone);
							_turnCount++;
							App.playSound("STONE.wav");
						}
						if (_turn === STONE_BLACK) {
							_turn = STONE_WHITE;
						} else if (_turn === STONE_WHITE) {
							_turn = STONE_BLACK;
						}
					} else if (result == false) {
						_board[relative_y][relative_x] = STONE_NONE;
						player.showCenterLabel(
							"금수 입니다. 놓을 수 없습니다.",
							0xffffff,
							0x000000,
							300
						);
					} else if (result == true) {
						_board_stack.push([relative_x, relative_y, playerColor]);

						if (playerColor == STONE_WHITE) {
							Map.putObject(x, y, whiteStone);
							App.playSound("STONE.wav");
						} else if (playerColor == STONE_BLACK) {
							Map.putObject(x, y, blackStone);
							App.playSound("STONE.wav");
						}
						if (_turn === STONE_BLACK) {
							win_game(STONE_BLACK);
						} else if (_turn === STONE_WHITE) {
							win_game(STONE_WHITE);
						}
					}
				} else {
					player.showCenterLabel(
						"둘 수 없는 자리입니다.",
						0xffffff,
						0x000000,
						300
					);
				}
			} else {
				player.showCenterLabel("차례가 아닙니다.", 0xffffff, 0x000000, 300);
			}
		}
	}
});

// 모바일을 위한 스페이스바 이벤트 => 작동 안함
// App.addOnKeyDown(32, function (player) {
// 	if (_start === true) {
// 		if (player.tag.joined === true) {
// 			let x = player.tileX;
// 			let y = player.tileY;

// 			let relative_x = x - startPoint[0];
// 			let relative_y = y - startPoint[1];

// 			if (relative_x > BOARD_SIZE) relative_x = BOARD_SIZE;
// 			if (relative_y > BOARD_SIZE) relative_y = BOARD_SIZE;

// 			// if (relative_x - 1 >= 0) relative_x = relative_x - 1;
// 			// if (relative_y - 1 >= 0) relative_y = relative_y - 1;

// 			let playerColor = player.tag.color;

// 			// App.sayToAll("돌 놓기 테스트1");

// 			// 이 좌표에 돌이 놓여있는지 검사하는 코드 필요.
// 			// 돌이 안놓여있다면, 돌을 놓은 위치를 배열에 저장?
// 			if (playerColor === _turn) {
// 				// App.sayToAll("돌 놓기 테스트2");
// 				if (_board[relative_y][relative_x] == STONE_NONE) {
// 					_board[relative_y][relative_x] = playerColor;

// 					let result = check_pointer(
// 						relative_x,
// 						relative_y,
// 						playerColor,
// 						_board
// 					);

// 					if (result == null) {
// 						_board_stack.push([relative_x, relative_y, playerColor]);

// 						if (playerColor == STONE_WHITE) {
// 							_tickTockSoundOn = false;
// 							_stateTimer = 22;
// 							if (_appWidget) {
// 								_appWidget.destroy();
// 								_appWidget = null;
// 							}
// 							_appWidget = App.showWidget("black_timer.html", "top", 400, 200);
// 							Map.putObject(x, y, whiteStone);
// 							App.playSound("STONE.wav");
// 						} else if (playerColor == STONE_BLACK) {
// 							tickTockSoundOn = false;
// 							_stateTimer = 22;
// 							if (_appWidget) {
// 								_appWidget.destroy();
// 								_appWidget = null;
// 							}
// 							_appWidget = App.showWidget("white_timer.html", "top", 400, 200);
// 							Map.putObject(x, y, blackStone);
// 							App.playSound("STONE.wav");
// 						}
// 						if (_turn === STONE_BLACK) {
// 							_turn = STONE_WHITE;
// 						} else if (_turn === STONE_WHITE) {
// 							_turn = STONE_BLACK;
// 						}
// 					} else if (result == false) {
// 						_board[relative_y][relative_x] = STONE_NONE;
// 						player.showCenterLabel(
// 							"금수 입니다. 놓을 수 없습니다.",
// 							0xffffff,
// 							0x000000,
// 							300
// 						);
// 					} else if (result == true) {
// 						_board_stack.push([relative_x, relative_y, playerColor]);

// 						if (playerColor == STONE_WHITE) {
// 							Map.putObject(x, y, whiteStone);
// 							App.playSound("STONE.wav");
// 						} else if (playerColor == STONE_BLACK) {
// 							Map.putObject(x, y, blackStone);
// 							App.playSound("STONE.wav");
// 						}
// 						if (_turn === STONE_BLACK) {
// 							win_game(STONE_BLACK);
// 						} else if (_turn === STONE_WHITE) {
// 							win_game(STONE_WHITE);
// 						}
// 					}
// 				} else {
// 					player.showCenterLabel(
// 						"둘 수 없는 자리입니다.",
// 						0xffffff,
// 						0x000000,
// 						300
// 					);
// 				}
// 			} else {
// 				player.showCenterLabel("차례가 아닙니다.", 0xffffff, 0x000000, 300);
// 			}
// 		}
// 	}
// });

function win_game(_stone) {
	// 게임 승리 관련 처리 루틴
	_start = false;
	_stateTimer = 0;
	let isBlackWin;
	if (_appWidget) {
		_appWidget.destroy();
		_appWidget = null;
	}
	App.playSound("LOSE.WAV");
	if (_stone == STONE_BLACK) {
		App.showCenterLabel("흑돌 승리!", 0xffffff, 0x000000, 300);
		isBlackWin = true;
	} else if (_stone == STONE_WHITE) {
		App.showCenterLabel("백돌 승리!", 0xffffff, 0x000000, 300);
		isBlackWin = false;
	}

	let players = App.players;
	for (let i in players) {
		let p = players[i];

		if (_turnCount > 10) {
			if (p.tag.color === STONE_BLACK) {
				if (isBlackWin) {
					p.tag.win = p.tag.win * 1 + 1;
				} else {
					p.tag.lose = p.tag.lose * 1 + 1;
				}
			} else if (p.tag.color === STONE_WHITE) {
				if (isBlackWin) {
					p.tag.lose = p.tag.lose * 1 + 1;
				} else {
					p.tag.win = p.tag.win * 1 + 1;
				}
			}
		}

		p.tag.joined = false;
		p.tag.color = "no color";

		p.sendUpdated();
	}

	if (_turnCount <= 10) {
		App.sayToAll("10수 이내에 끝난 게임은 승수에 반영되지 않습니다.", 0xda2f46);
	}

	App.runLater(() => {
		startState(STATE_INIT);
	}, 10);
	// print_winmsg(_stone);
	// end_game();
}

function startState(state) {
	_state = state;
	_stateTimer = 0;
	_tickTockSoundOn = false;

	switch (_state) {
		case STATE_INIT:
			_start = false;
			_playerCount = 0;
			_board = new Array();
			_board_stack = new Array();

			if (_appWidget) {
				_appWidget.destroy();
				_appWidget = null;
			}
			_players = App.players;
			for (let i in _players) {
				let p = _players[i];
				giveTitle(p);
				_userMainWidget.push(p.showWidget("init.html", "top", 400, 200));
			}
			sendMessageToPlayerWidget();

			for (let x = startPoint[0] - 1; x < startPoint[0] + BOARD_SIZE + 1; x++) {
				for (
					let y = startPoint[1] - 1;
					y < startPoint[1] + BOARD_SIZE + 1;
					y++
				) {
					if (
						x == startPoint[0] - 1 ||
						y == startPoint[1] - 1 ||
						x == startPoint[0] + BOARD_SIZE ||
						y == startPoint[1] + BOARD_SIZE
					) {
						Map.putTileEffect(x, y, 0);
					}
				}
			}
			Map.clearAllObjects();

			for (let i = 0; i < BOARD_SIZE; i++) {
				_board[i] = new Array();
				for (let j = 0; j < BOARD_SIZE; j++) {
					_board[i][j] = STONE_NONE;
				}
			}

			break;
		case STATE_START:
			_stateTimer = 22;
			_start = true;
			_turn = STONE_BLACK;
			App.playSound("ROOMIN.wav");
			App.showCenterLabel(
				`'X' 를 눌러 수를 둘 수 있습니다.`,
				0xffffff,
				0x000000,
				300
			);
			if (_userMainWidget.length !== 0) {
				for (let i in _userMainWidget) {
					let w = _userMainWidget[i];
					if (w !== null) {
						w.destroy();
					}
				}
			}
			_userMainWidget.splice(0);

			if (_appWidget) {
				_appWidget.destroy();
				_appWidget = null;
			}
			_appWidget = App.showWidget("black_timer.html", "top", 500, 130);
			let players = App.players;

			// 참가하지 않은 플레이어 바둑판 밖으로 내보내기
			for (let i in players) {
				let p = players[i];
				if (p.tag.joined == true) {
					if (p.tag.color == STONE_BLACK) {
						p.spawnAt(startPoint[0], startPoint[1] + 9);
						p.dir = 1;
						p.sendUpdated();
					} else {
						p.spawnAt(startPoint[0] + 18, startPoint[1] + 9);
						p.dir = 3;
						p.sendUpdated();
					}
				} else {
					let rand = Math.floor(Math.random() * (BOARD_SIZE * 2));
					if (standLocation[rand]) {
						p.spawnAt(standLocation[rand][0], standLocation[rand][1]);
					}
				}
			}
			// 바둑판 테두리부분 impassable 타일로 감싸기
			for (let x = startPoint[0] - 1; x < startPoint[0] + BOARD_SIZE + 1; x++) {
				for (
					let y = startPoint[1] - 1;
					y < startPoint[1] + BOARD_SIZE + 1;
					y++
				) {
					if (
						x == startPoint[0] - 1 ||
						y == startPoint[1] - 1 ||
						x == startPoint[0] + BOARD_SIZE ||
						y == startPoint[1] + BOARD_SIZE
					) {
						Map.putTileEffect(x, y, 1);
						Map.putObject(x, y, wall);
					}
				}
			}

			break;
	}
}

function check_pointer(_x, _y, _stone, _board) {
	var x, y;

	// 돌 카운트 변수들
	var count; // 단순 카운팅
	var count_black; // 흑돌 카운팅
	var count_none; // 빈칸 카운팅
	var count_white; // 백돌 카운팅

	// 3x3, 4x4 판단용 boolean 변수들
	var hori_33 = false; // 가로 33
	var vert_33 = false; // 세로 33
	var ltrb_33 = false; // 대각선↘ 33
	var rtlb_33 = false; // 대각선↙ 33
	var hori_44 = false; // 가로 44
	var vert_44 = false; // 세로 44
	var ltrb_44 = false; // 대각선↘ 44
	var rtlb_44 = false; // 대각선↙ 44

	if (_stone == STONE_BLACK) {
		// 금수는 흑에게만 적용
		/*      3*3 판별 로직      */
		// 가로 방향 카운팅
		x = _x;
		y = _y;
		count_black = 1;
		count_none = 0;
		count_white = 0;

		// 가로 우 방향
		for (var i = 1; i < 4; i++) {
			// 게임판 탈출 방지 루틴
			if (x + i > BOARD_SIZE - 1) break;
			if (_board[_y][x + i] != STONE_WHITE) {
				if (_board[_y][x + i] == STONE_BLACK) {
					count_black++;
				} else if (_board[_y][x + i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[_y][x + i] == STONE_WHITE) {
				count_white++;
				break;
			}
			// 기본적으로 3칸까지만 카운팅 하고, 4번째 칸이 백돌일때만 추가 카운팅
			if (i == 3 && x + i + 1 < BOARD_SIZE)
				if (_board[_y][x + i + 1] == STONE_WHITE) count_white++;
		}
		// 가로 우 방향 열린 3 여부 체킹
		var tmp_hori_33 = true;
		if (count_none <= count_white) tmp_hori_33 = false;

		// 가로 좌 방향
		for (var i = 1; i < 4; i++) {
			// 게임판 탈출 방지 루틴
			if (x - i < 0) break;
			if (_board[_y][x - i] != STONE_WHITE) {
				if (_board[_y][x - i] == STONE_BLACK) {
					count_black++;
				} else if (_board[_y][x - i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[_y][x - i] == STONE_WHITE) {
				count_white++;
				break;
			}
			// 기본적으로 3칸까지만 카운팅 하고, 4번째 칸이 백돌일때만 추가 카운팅
			if (i == 3 && x - i - 1 > 0)
				if (_board[_y][x - i - 1] == STONE_WHITE) count_white++;
		}
		// 둘다 열린 3이면서 흑돌이 3개인 경우
		if (count_none - count_white > 3 && tmp_hori_33 && count_black == 3)
			hori_33 = true; // 가로 방향 3x3 판정

		// 세로 방향 카운팅
		x = _x;
		y = _y;
		count_black = 1;
		count_none = 0;
		count_white = 0;

		// 세로 하 방향
		for (var i = 1; i < 4; i++) {
			// 게임판 탈출 방지 루틴
			if (y + i > BOARD_SIZE - 1) break;
			if (_board[y + i][_x] != STONE_WHITE) {
				if (_board[y + i][_x] == STONE_BLACK) {
					count_black++;
				} else if (_board[y + i][_x] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y + i][_x] == STONE_WHITE) {
				count_white++;
				break;
			}
			// 기본적으로 3칸까지만 카운팅 하고, 4번째 칸이 백돌일때만 추가 카운팅
			if (i == 3 && y + i + 1 < BOARD_SIZE)
				if (_board[y + i + 1][_x] == STONE_WHITE) count_white++;
		}
		// 세로 하 방향 열린 3 여부 체킹
		var tmp_vert_33 = true;
		if (count_none <= count_white) tmp_vert_33 = false;

		// 세로 상 방향
		for (var i = 1; i < 4; i++) {
			// 게임판 탈출 방지 루틴
			// App.sayToAll(`${y}, ${_x}`);
			if (y - i < 0) break;
			if (_board[y - i][_x] != STONE_WHITE) {
				// App.sayToAll(`에러체크1 ${i}`);
				if (_board[y - i][_x] == STONE_BLACK) {
					count_black++;
				} else if (_board[y - i][_x] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y - i][_x] == STONE_WHITE) {
				// App.sayToAll(`에러체크2 ${i}`);
				count_white++;
				break;
			}
			// 기본적으로 3칸까지만 카운팅 하고, 4번째 칸이 백돌일때만 추가 카운팅
			if (i == 3 && y - i - 1 > 0)
				if (_board[y - i - 1][_x] == STONE_WHITE) count_white++;
		}
		// 둘다 열린 3면서 흑돌이 3개인 경우
		if (count_none - count_white > 3 && tmp_vert_33 && count_black == 3)
			vert_33 = true; // 세로 방향 33 판정

		// 대각선↘
		x = _x;
		y = _y;
		count_black = 1;
		count_none = 0;
		count_white = 0;

		// 대각선 우 방향
		for (var i = 1; i < 4; i++) {
			// 게임판 탈출 방지 루틴
			if (y + i > BOARD_SIZE - 1 || x + i > BOARD_SIZE - 1) break;
			if (_board[y + i][x + i] != STONE_WHITE) {
				if (_board[y + i][x + i] == STONE_BLACK) {
					count_black++;
				} else if (_board[y + i][x + i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y + i][x + i] == STONE_WHITE) {
				count_white++;
				break;
			}
			// 기본적으로 3칸까지만 카운팅 하고, 4번째 칸이 백돌일때만 추가 카운팅
			if (i == 3 && y + i + 1 < BOARD_SIZE && x + i + 1 < BOARD_SIZE)
				if (_board[y + i + 1][x + i + 1] == STONE_WHITE) count_white++;
		}
		// 대각선 우 방향 열린 3 여부 체킹
		var tmp_ltrb_33 = true;
		if (count_none <= count_white) tmp_ltrb_33 = false;

		// 대각선 좌 방향
		for (var i = 1; i < 4; i++) {
			// 게임판 탈출 방지 루틴
			if (y - i < 0 || x - i < 0) break;
			if (_board[y - i][x - i] != STONE_WHITE) {
				if (_board[y - i][x - i] == STONE_BLACK) {
					count_black++;
				} else if (_board[y - i][x - i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y - i][x - i] == STONE_WHITE) {
				count_white++;
				break;
			}
			// 기본적으로 3칸까지만 카운팅 하고, 4번째 칸이 백돌일때만 추가 카운팅
			if (i == 3 && y - i - 1 > 0 && x - i - 1 > 0)
				if (_board[y - i - 1][x - i - 1] == STONE_WHITE) count_white++;
		}
		// 둘다 열린 3 이면서 흑돌이 3개인 경우
		if (count_none - count_white > 3 && tmp_ltrb_33 && count_black == 3)
			ltrb_33 = true; // 대각선↘ 방향 33 판정

		// 대각선↙
		x = _x;
		y = _y;
		count_black = 1;
		count_none = 0;
		count_white = 0;

		// 대각선 좌 방향
		for (var i = 1; i < 4; i++) {
			// 게임판 탈출 방지 루틴
			if (y + i > BOARD_SIZE - 1 || x - i < 0) break;
			if (_board[y + i][x - i] != STONE_WHITE) {
				if (_board[y + i][x - i] == STONE_BLACK) {
					count_black++;
				} else if (_board[y + i][x - i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y + i][x - i] == STONE_WHITE) {
				count_white++;
				break;
			}
			// 기본적으로 3칸까지만 카운팅 하고, 4번째 칸이 백돌일때만 추가 카운팅
			if (i == 3 && y + i + 1 < BOARD_SIZE && x - i - 1 > 0)
				if (_board[y + i + 1][x - i - 1] == STONE_WHITE) count_white++;
		}
		// 대각선 좌 방향 열린 3 여부 체킹
		var tmp_rtlb_33 = true;
		if (count_none <= count_white) tmp_rtlb_33 = false;

		// 대각선 우 방향
		for (var i = 1; i < 4; i++) {
			// 게임판 탈출 방지 루틴
			if (y - i < 0 || x + i > BOARD_SIZE - 1) break;
			if (_board[y - i][x + i] != STONE_WHITE) {
				if (_board[y - i][x + i] == STONE_BLACK) {
					count_black++;
				} else if (_board[y - i][x + i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y - i][x + i] == STONE_WHITE) {
				count_white++;
				break;
			}
			// 기본적으로 3칸까지만 카운팅 하고, 4번째 칸이 백돌일때만 추가 카운팅
			if (i == 3 && y - i - 1 > 0 && x + i + 1 < BOARD_SIZE)
				if (_board[y - i - 1][x + i + 1] == STONE_WHITE) count_white++;
		}
		// 둘다 열린 3 이면서 흑돌이 3개인 경우
		if (count_none - count_white > 3 && tmp_rtlb_33 && count_black == 3)
			rtlb_33 = true; // 대각선↙ 방향 33 판정

		/*      4*4 판별 로직      */
		// 가로
		x = _x;
		y = _y;
		count_black = 1;
		count_none = 0;
		count_white = 0;

		for (var i = 1; i < 5; i++) {
			if (x + i > BOARD_SIZE - 1) break;
			if (_board[_y][x + i] != STONE_WHITE) {
				if (_board[_y][x + i] == STONE_BLACK) {
					count_black++;
				} else if (_board[_y][x + i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[_y][x + i] == STONE_WHITE) {
				count_white++;
				break;
			}
		}

		for (var i = 1; i < 5; i++) {
			if (x - i < 0) break;
			if (_board[_y][x - i] != STONE_WHITE) {
				if (_board[_y][x - i] == STONE_BLACK) {
					count_black++;
				} else if (_board[_y][x - i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[_y][x - i] == STONE_WHITE) {
				count_white++;
				break;
			}
		}

		// 둘다 열린 4 이면서 흑돌이 4개인 경우
		if (count_none >= count_white && count_black == 4) hori_44 = true; // 가로 방향 44 판정

		// 세로
		x = _x;
		y = _y;
		count_black = 1;
		count_none = 0;
		count_white = 0;

		for (var i = 1; i < 5; i++) {
			if (y + i > BOARD_SIZE - 1) break;
			if (_board[y + i][_x] != STONE_WHITE) {
				if (_board[y + i][_x] == STONE_BLACK) {
					count_black++;
				} else if (_board[y + i][_x] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y + i][_x] == STONE_WHITE) {
				count_white++;
				break;
			}
		}

		for (var i = 1; i < 5; i++) {
			if (y - i < 0) break;
			if (_board[y - i][_x] != STONE_WHITE) {
				if (_board[y - i][_x] == STONE_BLACK) {
					count_black++;
				} else if (_board[y - i][_x] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y - i][_x] == STONE_WHITE) {
				count_white++;
				break;
			}
		}

		// 둘다 열린 4 이면서 흑돌이 4개인 경우
		if (count_none >= count_white && count_black == 4) vert_44 = true; // 세로 방향 44 판정

		// 대각선↘
		x = _x;
		y = _y;
		count_black = 1;
		count_none = 0;
		count_white = 0;

		for (var i = 1; i < 5; i++) {
			if (y + i > BOARD_SIZE - 1 || x + i > BOARD_SIZE - 1) break;
			if (_board[y + i][x + i] != STONE_WHITE) {
				if (_board[y + i][x + i] == STONE_BLACK) {
					count_black++;
				} else if (_board[y + i][x + i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y + i][x + i] == STONE_WHITE) {
				count_white++;
				break;
			}
		}

		for (var i = 1; i < 5; i++) {
			if (y - i < 0 || x - i < 0) break;
			if (_board[y - i][x - i] != STONE_WHITE) {
				if (_board[y - i][x - i] == STONE_BLACK) {
					count_black++;
				} else if (_board[y - i][x - i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y - i][x - i] == STONE_WHITE) {
				count_white++;
				break;
			}
		}

		// 둘다 열린 4 이면서 흑돌이 4개인 경우
		if (count_none >= count_white && count_black == 4) ltrb_44 = true; // 대각선↘ 방향 44 판정

		// 대각선↙ new
		x = _x;
		y = _y;
		count_black = 1;
		count_none = 0;
		count_white = 0;

		for (var i = 1; i < 5; i++) {
			if (y + i > BOARD_SIZE - 1 || x - i < 0) break;
			if (_board[y + i][x - i] != STONE_WHITE) {
				if (_board[y + i][x - i] == STONE_BLACK) {
					count_black++;
				} else if (_board[y + i][x - i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y + i][x - i] == STONE_WHITE) {
				count_white++;
				break;
			}
		}

		for (var i = 1; i < 5; i++) {
			if (y - i < 0 || x + i > BOARD_SIZE - 1) break;
			if (_board[y - i][x + i] != STONE_WHITE) {
				if (_board[y - i][x + i] == STONE_BLACK) {
					count_black++;
				} else if (_board[y - i][x + i] == STONE_NONE) {
					count_none++;
				}
			} else if (_board[y - i][x + i] == STONE_WHITE) {
				count_white++;
				break;
			}
		}

		// 둘다 열린 4 이면서 흑돌이 4개인 경우
		if (count_none >= count_white && count_black == 4) rtlb_44 = true; // 대각선↙ 방향 44 판정

		// 3*3 판정 결과중 가로,세로,대각선 2개방향 중 2개이상이 해당될 경우(3*3 인 상황)
		if (hori_33 + vert_33 + ltrb_33 + rtlb_33 >= 2) {
			// 33 판정 결과 먼저 확인
			return false; // 금수 처리
		}
		// 4*4 판정 결과중 가로,세로,대각선 2개방향 중 2개이상이 해당될 경우(4*4 인 상황)
		else if (hori_44 + vert_44 + ltrb_44 + rtlb_44 >= 2) {
			return false; // 금수 처리
		}

		/*      4*4 예외 판별 로직      */
		/* 위의 4*4 판별 로직에서 걸러낼수 없는 동일 축 내에서 2개의 44가 발생하는 경우 */
		/* ●●빈●●빈●● 이거랑 ●빈●●●빈● 패턴 찾아내기 */
		// 패턴 문자열 변수들
		var hori_44 = "";
		var vert_44 = "";
		var ltrb_44 = "";
		var rtlb_44 = "";

		// 가로
		// 모든 가로축에 돌들에 대해 수집
		for (var i = 0; i < BOARD_SIZE; i++) {
			hori_44 = hori_44.concat(_board[_y][i]);
		}

		// 세로
		// 모든 세로축에 돌들에 대해 수집
		for (var i = 0; i < BOARD_SIZE; i++) {
			vert_44 = vert_44.concat(_board[i][_x]);
		}

		// 대각선 ↘
		// 모든 대각선 ↘에 돌들에 대해 수집
		x = _x;
		y = _y;

		// 대각선 끝점 찾기
		while (y > 0 && x > 0) {
			y--;
			x--;
		}

		do {
			ltrb_44 = ltrb_44.concat(_board[y][x]);
		} while (++y < BOARD_SIZE && ++x < BOARD_SIZE);

		// 대각선 ↙
		// 모든 대각선 ↙의 돌들에 대해 수집
		x = _x;
		y = _y;

		// 대각선 끝점 찾기
		while (y > 0 && x < BOARD_SIZE) {
			y--;
			x++;
		}

		do {
			rtlb_44 = rtlb_44.concat(_board[y][x]);
		} while (++y < BOARD_SIZE && --x > 0);

		// 찾아낼 착수 패턴 문자열 변수들
		pt1 =
			"" +
			STONE_BLACK +
			("" + STONE_BLACK) +
			("" + STONE_NONE) +
			("" + STONE_BLACK) +
			("" + STONE_BLACK) +
			("" + STONE_NONE) +
			("" + STONE_BLACK) +
			("" + STONE_BLACK);

		pt2 =
			"" +
			STONE_BLACK +
			("" + STONE_NONE) +
			("" + STONE_BLACK) +
			("" + STONE_BLACK) +
			("" + STONE_BLACK) +
			("" + STONE_NONE) +
			("" + STONE_BLACK);

		// 가로,세로,대각선2방향의 돌 정보중 패턴이 하나라도 포함될 경우, 44 예외 판정
		if (hori_44.includes(pt1) || hori_44.includes(pt2))
			// 가로
			return false; // 금수 처리
		else if (vert_44.includes(pt1) || vert_44.includes(pt2))
			// 세로
			return false;
		else if (ltrb_44.includes(pt1) || ltrb_44.includes(pt2))
			// 대각선↘
			return false;
		else if (rtlb_44.includes(pt1) || rtlb_44.includes(pt2))
			// 대각선↙
			return false;

		/* 5,6목 이상 판별 로직 */
		// 가로
		x = _x;
		y = _y;
		count = 0;
		// 카운팅 시작점 찾기
		while (x-- > 0 && _board[_y][x] == STONE_BLACK);
		// 카운팅
		while (++x < BOARD_SIZE && _board[_y][x] == STONE_BLACK) count++;

		// 6목 이상일 경우
		if (count > 5) return false; // 금수 처리
		// 정확히 5목 일 경우
		else if (count == 5) return true; // 승리 처리

		// 세로
		x = _x;
		y = _y;
		count = 0;
		// 카운팅 시작점 찾기
		while (y-- > 0 && _board[y][_x] == STONE_BLACK);
		// 카운팅
		while (++y < BOARD_SIZE && _board[y][_x] == STONE_BLACK) count++;

		if (count > 5) return false;
		else if (count == 5) return true;

		// 대각선 ↘
		x = _x;
		y = _y;
		count = 0;
		// 카운팅 시작점 찾기
		while (x-- > 0 && y-- > 0 && _board[y][x] == STONE_BLACK);
		// 카운팅
		while (++x < BOARD_SIZE && ++y < BOARD_SIZE && _board[y][x] == STONE_BLACK)
			count++;

		if (count > 5) return false;
		else if (count == 5) return true;

		// 대각선 ↙
		x = _x;
		y = _y;
		count = 0;
		// 카운팅 시작점 찾기
		while (x++ < BOARD_SIZE && y-- > 0 && _board[y][x] == STONE_BLACK);
		// 카운팅
		while (--x > 0 && ++y < BOARD_SIZE && _board[y][x] == STONE_BLACK) count++;

		if (count > 5) return false;
		else if (count == 5) return true;
	} else if (_stone == STONE_WHITE) {
		/*      백 승리 판별 로직      */
		/* 백(후수)은 모든 금수 처리에 대해 예외이기 때문에 승리 조건만 검사 */
		// 백 승리 검사용 문자열 변수들
		var hori_win = "";
		var vert_win = "";
		var ltrb_win = "";
		var rtlb_win = "";

		// 가로
		// 가로 방향에 대해 모든 돌 정보 수집
		for (var i = 0; i < BOARD_SIZE; i++) {
			hori_win = hori_win.concat(_board[_y][i]);
		}

		// 세로
		for (var i = 0; i < BOARD_SIZE; i++) {
			vert_win = vert_win.concat(_board[i][_x]);
		}

		// 대각선 ↘
		x = _x;
		y = _y;

		// 대각선 끝점 선정
		while (y > 0 && x > 0) {
			y--;
			x--;
		}
		do {
			ltrb_win = ltrb_win.concat(_board[y][x]);
		} while (++y < BOARD_SIZE && ++x < BOARD_SIZE);

		// 대각선 ↙
		x = _x;
		y = _y;

		// 대각선 끝점 선정
		while (y > 0 && x < BOARD_SIZE) {
			y--;
			x++;
		}
		do {
			rtlb_win = rtlb_win.concat(_board[y][x]);
		} while (++y < BOARD_SIZE && --x > 0);

		// 찾아낼 착수 패턴
		pt =
			"" +
			STONE_WHITE +
			("" + STONE_WHITE) +
			("" + STONE_WHITE) +
			("" + STONE_WHITE) +
			("" + STONE_WHITE);

		// 가로,세로,대각선2 방향 중 패턴과 하나라도 일치할 경우, 백 승리 판정
		if (hori_win.includes(pt)) return true;
		else if (vert_win.includes(pt)) return true;
		else if (ltrb_win.includes(pt)) return true;
		else if (rtlb_win.includes(pt)) return true;
	}
	// 모든 금수 로직에 걸리지 않았을 경우
	return null; // 정상 착수 처리
}

function sendMessageToPlayerWidget(data = null) {
	for (let i in _userMainWidget) {
		let p_widget = _userMainWidget[i];
		if (p_widget) {
			switch (_state) {
				case STATE_INIT:
					p_widget.sendMessage({
						total: 2,
						current: _playerCount,
					});

					break;
			}
		}
	}
}

App.addOnKeyDown(86, _speed); // v키를 누르면속도가 200
function _speed(p) {
	p.moveSpeed = 200;
	let a = (p.tag.skill_x = false);
	let b = (p.tag.skill_x_timer = 20);
	p.tag.skill_x = true; // true로 공격가능하게하고
	p.sendUpdated(); // 업데이트 적용
}
