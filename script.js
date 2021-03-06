/* global Vue:false */

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

Vue.component('modal-alert', {
  template: `
    <transition name="modal">
      <div class="modal" @click="$emit('close')">
        <div class="modal-container" @click.stop>
          <slot/>
        </div>
      </div>
    </transition>
  `,

  mounted() {
    document.body.appendChild(this.$el);
  },
});

class Board {
  constructor(width, height) {
    this.list = [];
    this.width = width;
    this.height = height;
    this.start = null;
    this.goal = null;
    this.player = null;
    this.init();
  }

  init() {
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++)
        this.list.push(new Cell(this, x, y, Cell.Wall));

    let next;
    let dir;

    const points = [this.getCell(this.width - 2, 1).dig()];

    while (next || points.length) {
      const cell = next || points.splice(points.length * Math.random() | 0, 1)[0];
      const targets = cell.around
        .filter(c => c && c.isWall && 2 < c.around.filter(c => c && c.isWall).length);

      if (!targets.length) {
        next = null;
        continue;
      }

      next = targets[targets.length * Math.random() | 0];
      next.dig();

      if (1 < targets.length) {
        points.push(cell);
      }
    }

    this.goal = this.getCell(this.width - 2, 0);
    this.goal.dig();

    let start = this.getCell(1, this.height - 2);
    while (true) {
      if (start.isPath) {
        break;
      } else {
        start = start.right;
      }
    }

    this.start = start.bottom;
    this.setPlayer(this.start);
  }

  getCell(x, y) {
    return x < 0 || this.width <= x || y < 0 || this.height <= y
      ? null
      : this.list[y * this.width + x];
  }

  setPlayer(cell) {
    if (this.player) {
      this.player.type = Cell.Path;
    }
    cell.type = Cell.Player;
    this.player = cell;
  }

  movePlayerUp() {
    const cell = this.player.top;
    if (cell && cell.isPath) {
      this.setPlayer(cell);
    }
  }

  movePlayerRight() {
    const cell = this.player.right;
    if (cell && cell.isPath) {
      this.setPlayer(cell);
    }
  }

  movePlayerDown() {
    const cell = this.player.bottom;
    if (cell && cell.isPath) {
      this.setPlayer(cell);
    }
  }

  movePlayerLeft() {
    const cell = this.player.left;
    if (cell && cell.isPath) {
      this.setPlayer(cell);
    }
  }

  solve() {
    const queue = [[null, this.player, null]];
    const memo = new Map();

    while (queue.length) {
      const [prev, cell, dir] = queue.shift();
      memo.set(cell, [prev, dir]);
      if (cell === this.goal) {
        break;
      }
      queue.push(...cell.around
        .map((c, dir) => c && c.isPath && !memo.has(c) && [cell, c, dir])
        .filter(Boolean));
    }

    const dirs = [];
    let cell = this.goal;

    while (cell) {
      const [prev, dir] = memo.get(cell);
      if (!prev) {
        break;
      }
      dirs.unshift(dir);
      cell = prev;
    }

    return dirs;
  }
}

class Cell {
  constructor(board, x, y, type) {
    this.board = board;
    this.x = x;
    this.y = y;
    this.type = type;
  }

  dig() {
    this.type = Cell.Path;
    return this;
  }

  getNeighborByDir(dir) {
    switch (+dir) {
      case 0: return this.top;
      case 1: return this.right;
      case 2: return this.bottom;
      case 3: return this.left;
      default: throw new Error(`invalid dir: ${dir}`);
    }
  }

  get top() { return this.board.getCell(this.x, this.y - 1); }
  get right() { return this.board.getCell(this.x + 1, this.y); }
  get bottom() { return this.board.getCell(this.x, this.y + 1); }
  get left() { return this.board.getCell(this.x - 1, this.y); }
  get around() { return [this.top, this.right, this.bottom, this.left]; }

  get isPath() { return this.type === Cell.Path; }
  get isWall() { return this.type === Cell.Wall; }
  get isPlayer() { return this.type === Cell.Player; }
}

Cell.Path = 0;
Cell.Wall = 1;
Cell.Player = 2;

new Vue({
  el: '#app',

  data() {
    const board = new Board(15, 15);

    return {
      started: false,
      finished: false,
      canInput: true,
      modalShown: false,
      retryShown: false,
      startedAt: 0,
      endedAt: 0,
      board,
    };
  },

  computed: {
    time() {
      const ms = this.endedAt - this.startedAt;
      const minutes = `${ms / 1000 / 60 | 0}`.padStart(2, '0');
      const seconds = `${ms / 1000 % 60 | 0}`.padStart(2, '0');
      const mseconds = `${ms % 1000}`.padStart(3, '0');
      return `${minutes}:${seconds}.${mseconds}`;
    },
  },

  mounted() {
    $(document).on('keydown', async event => {
      if (!this.canInput) {
        return;
      }

      this.canInput = false;
      await this.onInput(event);
      this.canInput = true;
    });

    document.addEventListener(
      'touchmove',
      event => event.preventDefault(),
      { passive: false }
    );
  },

  methods: {
    async onInput(event) {
      switch (event.key || event.type) {
        case 'w':
        case 'ArrowUp':
          return this.handleMove('up');

        case 'd':
        case 'ArrowRight':
          return this.handleMove('right');

        case 's':
        case 'ArrowDown':
          return this.handleMove('down');

        case 'a':
        case 'ArrowLeft':
          return this.handleMove('left');

        case 'Enter':
          return this.handleMove('solve');
      }
    },

    async handleMove(direction) {
      if (this.finished) {
        return;
      }

      switch (direction) {
        case 0:
        case 'up':
          this.board.movePlayerUp();
          break;

        case 1:
        case 'right':
          this.board.movePlayerRight();
          break;

        case 2:
        case 'down':
          this.board.movePlayerDown();
          break;

        case 3:
        case 'left':
          this.board.movePlayerLeft();
          break;

        case 'solve':
          await this.startAutoSolve();
          break;

        default:
          return;
      }

      if (!this.started) {
        this.start();
      }

      if (this.board.player.y === 0) {
        this.finish();
      }
    },

    async startAutoSolve() {
      const dirs = this.board.solve();
      const quickness = Math.random() * 100;

      for (const dir of dirs) {
        this.handleMove(dir);

        await wait(quickness);
      }
    },

    start() {
      this.startedAt = Date.now();
      this.started = true;
    },

    async finish() {
      this.endedAt = Date.now();
      this.finished = true;

      await this.openModal();

      this.retryShown = true;
    },

    async openModal() {
      this.modalShown = true;

      await new Promise(resolve => this.$once('modalClosing', resolve));

      this.modalShown = false;

      await wait(300);
    },

    retry() {
      Object.assign(this.$data, this.$options.data.call(this));
    },
  },
});
