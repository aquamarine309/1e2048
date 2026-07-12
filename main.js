Decimal.prototype.copyFrom = function(value) {
  this.mag = value.mag;
  this.sign = value.sign;
  this.layer = value.layer;
};

const DC = Object.freeze({
  D0: new Decimal("0"),
  D1: new Decimal("1"),
  D2: new Decimal("2"),
  D16: new Decimal("16"),
  D20: new Decimal("20"),
  D9E15: new Decimal("9e15"),
  E1: new Decimal("10"),
  E10: new Decimal("1e10"),
  E20: new Decimal("1e20"),
  E1000: new Decimal("1e1000"),
  E9E15: new Decimal("1e9e15")
});

const T = {
  NUM: 0,
  MUL: 1,
  NEG: 2
}

// Deepmerge library modified for Antimatter Dimensions usage (mainly Decimal integration)
// Source: https://github.com/TehShrike/deepmerge

function emptyTarget(val) {
  return Array.isArray(val) ? [] : {};
}

function cloneUnlessOtherwiseSpecified(value, options) {
  if (value instanceof Decimal) {
    return new Decimal(value);
  }
  if (value instanceof Set) {
    return new Set(value);
  }
  return (options.clone !== false && options.isMergeableObject(value))
    ? deepmerge(emptyTarget(value), value, options)
    : value;
}

function defaultArrayMerge(target, source, options) {
  return target.concat(source).map(element => cloneUnlessOtherwiseSpecified(element, options));
}

function mergeObject(target, source, options) {
  const destination = {};
  if (options.isMergeableObject(target)) {
    Object.keys(target).forEach(key => {
      destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
    });
  }
  Object.keys(source).forEach(key => {
    if (target[key] && target[key] instanceof Decimal) {
      destination[key] = new Decimal(source[key]);
    } else if (target[key] && target[key] instanceof Set) {
      destination[key] = new Set(source[key]);
    } else if (!options.isMergeableObject(source[key]) || !target[key]) {
      destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
    } else {
      destination[key] = deepmerge(target[key], source[key], options);
    }
  });
  return destination;
}

function deepmerge(target, source, options = {}) {
  options.arrayMerge = options.arrayMerge || defaultArrayMerge;
  options.isMergeableObject = options.isMergeableObject || isMergeableObject;

  if (target instanceof Decimal) {
    return new Decimal(source);
  }

  if (target instanceof Set) {
    return new Set(source);
  }

  const sourceIsArray = Array.isArray(source);
  const targetIsArray = Array.isArray(target);
  const sourceAndtargetTypesMatch = sourceIsArray === targetIsArray;

  if (!sourceAndtargetTypesMatch) {
    return cloneUnlessOtherwiseSpecified(source, options);
  }

  if (sourceIsArray) {
    return options.arrayMerge(target, source, options);
  }

  return mergeObject(target, source, options);
}

function deepmergeAll(array, options) {
  if (!Array.isArray(array)) {
    throw new Error("first argument should be an array");
  }

  if (!options) {
    // eslint-disable-next-line no-shadow
    const deepCloneMerge = (destinationArray, sourceArray, options) => sourceArray.map((element, index) => {
      if (destinationArray[index] && destinationArray[index] instanceof Decimal) {
        return new Decimal(element);
      }

      if (destinationArray[index] && destinationArray[index] instanceof Set) {
        return new Set(element);
      }

      if (!options.isMergeableObject(element) || !destinationArray[index]) {
        return cloneUnlessOtherwiseSpecified(element, options);
      }
      return deepmerge(destinationArray[index], element, options);

    });
    // eslint-disable-next-line no-param-reassign
    options = {
      arrayMerge: deepCloneMerge
    };
  }

  return array.reduce((prev, next) => deepmerge(prev, next, options), {});
}

function isMergeableObject(value) {
  return isNonNullObject(value) && !isSpecial(value);
}

function isNonNullObject(value) {
  return Boolean(value) && typeof value === "object";
}

function isSpecial(value) {
  const stringValue = Object.prototype.toString.call(value);
  return stringValue === "[object RegExp]" || stringValue === "[object Date]";
}


function defaultGrid() {
  return deepmergeAll([{}, Array(4).fill(0).map(() => Array(4).fill(0).map(() => ({
    value: DC.D0,
    type: T.NUM
  })))]);
}

window.player = {
  grid: defaultGrid(),
  powChance: 0,
  baseBlock: 0,
  clearTimes: 0,
  bonusTimes: 0,
  bonusSteps: 0,
  score: DC.D1,
  bestScore: DC.D1,
  voidPoints: DC.D0,
  voidUpgrades: new Set()
};

const Player = {
  defaultStart: deepmergeAll([{}, player])
};

function getEncodedSave() {
  player.grid = deepmergeAll([defaultGrid(), app.grid]);
  const save = JSON.stringify(player, function(key, value) {
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  });
  return btoa(save);
}

window.copyToClipboard = (function() {
  const el = document.createElement("textarea");
  document.body.appendChild(el);
  el.style.position = "absolute";
  el.style.left = "-9999999px";
  el.setAttribute("readonly", "");
  return function(str) {
    try {
      el.value = str;
      el.select();
      return document.execCommand("copy");
    } catch (ex) {
      console.log(ex);
      return false;
    }
  };
}());

function exportSave() {
  copyToClipboard(getEncodedSave());
  alert("导出成功");
};

function saveGame(slient = true) {
  localStorage.setItem("2048-save", getEncodedSave());
  if (!slient) {
    alert("已保存游戏");
  }
}

setInterval(() => saveGame(), 5000);

function importSave(save = prompt("存档")) {
  if (!save) return;
  try {
    const decodedSave = JSON.parse(atob(save));
    if (!decodedSave.hasOwnProperty("grid")) {
      alert("你要不要看看你导入的是什么游戏的存档");
      return;
    }
    const playerObject = deepmergeAll([Player.defaultStart, decodedSave]);
    player = playerObject;
    app.initGame();
  } catch (e) {
    alert("存档无效");
    console.log(e);
  }
};

function format(value, places = 0, layerExp = 6) {
  const decimal = Decimal.fromValue_noAlloc(value);
  if (!decimal.isFinite()) return "NaN";
  if (decimal.sign < 0) {
    return `-${format(decimal.neg(), places)}`;
  }
  if (decimal.sign === 0) {
    return (0).toFixed(places);
  }
  let exp = decimal.log10().floor();
  if (places > 1 && exp.lt(-places)) {
    let expCeil = decimal.log10().ceil();
    const mantissa = decimal.div(Decimal.pow10(expCeil));
    const be = expCeil.neg().clampMin(1).log10().gte(9);
    let formatMantissa = be ? "" : mantissa.toFixed(3);
    if (formatMantissa === "10.000") {
      formatMantissa = "1.000";
      expCeil = expCeil.add(1);
    }
    const formatExponent = format(expCeil, 0, layerExp);
    return `${formatMantissa}e${formatExponent}`;
  }
  if (exp.lt(layerExp)) {
    const expNum = exp.toNumber();
    const fixed = expNum <= 0 ? places : Math.max(places - expNum, 0);
    return formatWithCommas(decimal.toFixed(fixed));
  }
  if (decimal.layer >= 5) {
    const layer = decimal.layer;
    const formatMag = layer < 1e9 ? decimal.mag.toFixed(3) : "";
    const formatLayer = format(layer, 0);
    return `${formatMag}F${formatLayer}`;
  }
  const mantissa = decimal.div(Decimal.pow10(exp));
  const be = exp.gt(1e9);
  let formatMantissa = be ? "" : mantissa.toFixed(3);
  if (formatMantissa === "10.000") {
    formatMantissa = "1.000";
    exp = exp.add(1);
  }
  const formatExponent = format(exp, 0, layerExp);
  return `${formatMantissa}e${formatExponent}`;
}

/**
 * @param {string} value
 * @param {number} index
 * @returns {String}
 */
function commaSection(value, index) {
  if (index === 0) {
    return value.slice(-3);
  }
  return value.slice(-3 * (index + 1), -3 * index);
}

/**
 * @param {string} value
 * @returns {String}
 */
function addCommas(value) {
  let string = "";
  const start = Math.ceil(value.length / 3);
  for (let i = start - 1; i >= 0; i--) {
    string += commaSection(value, i);
    if (i !== 0) string += ",";
  }
  return string;
}

/**
 * @param {String} value
 * @returns {String}
 */
function formatWithCommas(value) {
  const decimalPointSplit = value.split(".");
  decimalPointSplit[0] = decimalPointSplit[0].replace(/\w+$/gu, addCommas);
  return decimalPointSplit.join(".");
}

window.formatTile = function(value, type) {
  if  (type === T.NEG) {
    return `↓${format(value)}`;
  }
  if (type === T.MUL) {
    return formatPow(value);
  }
  if (value.gte(DC.E1)) {
    return `2<sup>${format(value)}</sup>`;
  }
  return format(DC.D2.pow(value));
};

window.formatPow = function(value, places, layerExp) {
  return `^${format(value, places, layerExp)}`;
}

class UpgradeState {
  constructor() {
    this.update();
  }
  
  update() {
    this.cachedCost = this.cost;
    this.cachedEffect = this.effectValue;
  }
  
  get currency() {
    return player.score;
  }

  set currency(value) {
    player.score = value;
  }

  /**
   *@abstract
  */
  get amount() {
    throw new Error("Cannot call abstract getter");
  }

  /**
   *@abstract
  */
  set amount(value) {
    throw new Error("Cannot call abstract setter");
  }

  /**
   *@abstract
  */
  get cost() {
    throw new Error("Cannot call abstract getter");
  }

  get isAffordable() {
    return this.currency.gte(this.cost);
  }

  /**
   *@abstract
  */
  get effectValue() {
    throw new Error("Cannot call abstract getter");
  }

  purchase() {
    if (!this.isAffordable) return false;
    this.currency = this.currency.div(this.cost);
    this.amount++;
    player.clearTimes++;
    this.update();
    return true;
  }
  
  reset() {
    this.amount = 0;
    this.update();
  }
}

const Upgrades = {
  powChance: new class extends UpgradeState {
    get amount() {
      return player.powChance;
    }

    set amount(value) {
      player.powChance = value;
    }

    get cost() {
      return DC.D20.pow(DC.D20.pow(this.amount)).times(DC.E10);
    }

    get effectValue() {
      return this.amount / 20;
    }
  }(),
  baseBlock: new class extends UpgradeState {
    get amount() {
      return player.baseBlock;
    }

    set amount(value) {
      player.baseBlock = value;
    }

    get cost() {
      return Decimal.pow10(DC.D16.pow(this.amount)).times(DC.E10);
    }

    get effectValue() {
      return DC.D2.pow(this.amount).round();
    }
  }()
};

function getBonusExp() {
  if (player.bonusTimes >= 67) return DC.E20;
  return DC.E20.min(DC.D2.pow(player.bonusTimes).add(3));
}

function calculateScore(value) {
  let expMul = DC.D2.pow(value.div(5));
  if (expMul.gte(DC.E1000)) {
    expMul = DC.E1000.times(expMul.div(DC.E1000).log10().add(1));
  }
  if (player.bonusSteps > 0) {
    expMul = expMul.pow(getBonusExp());
  }
  return value.times(expMul).max(1);
}

Vue.mixin({
  methods: {
    format(value, places, layerExp) {
      return format(value, places, layerExp);
    },
    formatTile(value, type) {
      return formatTile(value, type);
    }
  }
});

function resetGame() {
  player = deepmergeAll([{}, Player.defaultStart]);
}

function init() {
  const local = localStorage.getItem("2048-save");
  if (local === undefined) return;
  importSave(local);
}

function getNegBlockChance() {
  return (player.bonusTimes - 67) / 100;
}

const app = new Vue({
  el: '#app',
  data: {
    grid: defaultGrid(),
    tiles: [],
    nextId: 1,
    score: new Decimal(1),
    bestScore: new Decimal(1),
    gameOver: false,
    hasWon: false,
    touchStartX: 0,
    touchStartY: 0,
    touchEndX: 0,
    touchEndY: 0,
    powChance: 0,
    baseBlock: new Decimal(0),
    clearTimes: 0,
    bonusSteps: 0,
    bonusExp: new Decimal(0),
    powChanceCost: new Decimal(0),
    baseBlockCost: new Decimal(0),
    someAffordable: true,
    negBlockChance: 0,
    voidPoints: new Decimal(0),
    canFallVoid: false
  },
  computed: {
    over1000() {
      return this.score.gte(DC.E1000);
    },
    negUnlocked() {
      return this.powChance >= 1;
    },
    voidUnlocked() {
      return this.voidPoints.gt(0);
    }
  },
  created() {
    this.initGame();
    window.addEventListener('keydown', this.handleKeyDown);
  },
  watch: {
    bonusSteps(value) {
      player.bonusSteps = value;
    },
    score(value) {
      player.score = value;
    },
    bestScore(value) {
      player.bestScore = value;
    },
    clearTimes(value) {
      player.clearTimes = value;
    },
    voidUpgradesModalShow(value) {
      if (value) {
        this.$nextTick(() => {
          this.initvoidUpgrades();
        });
      }
    }
  },
  methods: {
    initGame() {
      this.grid = deepmergeAll([{}, player.grid]);
      this.updateTiles();
      this.score.copyFrom(player.score);
      this.bestScore.copyFrom(player.bestScore);
      this.canFallVoid = this.tiles.length === 0 && this.score.gt(1);
      this.gameOver = false;
      this.hasWon = false;
      this.updateUpgrades();
      if (!this.canFallVoid && this.grid.every(row => row.every(x => x.value.eq(0)))) {
        this.addRandomTile();
        this.addRandomTile();
      }
    },
    
    updateTiles() {
      this.tiles = [];
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
          const grid = this.grid[y][x];
          if (grid.value.eq(0)) continue;
          this.tiles.push({
            id: this.nextId++,
            x,
            y,
            ...grid
          });
        }
      }
    },
    
    updateAffordable() {
      this.someAffordable =  Upgrades.powChance.isAffordable ||
        Upgrades.baseBlock.isAffordable;
    },
    
    updateUpgrades() {
      this.score.copyFrom(player.score);
      Upgrades.powChance.update();
      Upgrades.baseBlock.update();
      this.powChance = Upgrades.powChance.cachedEffect;
      this.baseBlock = Upgrades.baseBlock.cachedEffect;
      this.powChanceCost = Upgrades.powChance.cachedCost;
      this.baseBlockCost = Upgrades.baseBlock.cachedCost;
      this.clearTimes = player.clearTimes;
      this.bonusSteps = player.bonusSteps;
      this.bonusExp = getBonusExp();
      this.updateAffordable();
      this.negBlockChance = getNegBlockChance();
      this.voidPoints.copyFrom(player.voidPoints);
    },

    restartGame() {
      resetGame();
      this.initGame();
    },

    addRandomTile() {
      const emptyCells = [];
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          if (this.grid[y][x].value.eq(0)) {
            emptyCells.push({ x, y });
          }
        }
      }

      if (emptyCells.length === 0) return;

      const { x, y } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      let type = T.NUM;
      if (Math.random() < this.powChance) {
        type = T.MUL;
      }
      if (this.negUnlocked && Math.random() < this.negBlockChance) {
        type = T.NEG;
      }
      const base = this.baseBlock;
      let value = new Decimal(Math.random() < 0.9 ? 0 : 1);
      switch (type) {
        case T.NUM:
          value = value.add(base);
          break;
        case T.MUL:
          value = value.add(base.log2().floor().add(2));
          break;
        case T.NEG:
          value = base.pow(value.add(1));
          break;
      }
      
      this.grid[y][x] = { value, type };
      this.tiles.push({
        id: this.nextId++,
        value,
        type,
        x,
        y,
        merged: false
      });
    },

    moveTiles(direction) {
      if (this.gameOver) return;
      if (this.canFallVoid) return;

      let moved = false;
      const newGrid = defaultGrid();
      const newTiles = [];

      // 方向配置：定义每个方向的遍历顺序
      const config = {
        0: { // 上: 从底部向上遍历 (y: 3 → 0)
          xStart: 0, xEnd: 4, xStep: 1,
          yStart: 0, yEnd: 4, yStep: 1
        },
        1: { // 右: 从右向左遍历 (x: 3 → 0)
          xStart: 3, xEnd: -1, xStep: -1,
          yStart: 0, yEnd: 4, yStep: 1
        },
        2: { // 下: 从顶部向下遍历 (y: 0 → 3)
          xStart: 0, xEnd: 4, xStep: 1,
          yStart: 3, yEnd: -1, yStep: -1
        },
        3: { // 左: 从左向右遍历 (x: 0 → 3)
          xStart: 0, xEnd: 4, xStep: 1,
          yStart: 0, yEnd: 4, yStep: 1
        }
      };

      const { xStart, xEnd, xStep, yStart, yEnd, yStep } = config[direction];

      for (let y = yStart; y !== yEnd; y += yStep) {
        for (let x = xStart; x !== xEnd; x += xStep) {
          if (this.grid[y][x].value.eq(0)) continue;

          let newX = x, newY = y;
          let grid = this.grid[y][x];
          let merged = false;

          // 沿着移动方向寻找新位置
          let nextCoord;
          while (nextCoord = this.getNextCoord(newX, newY, direction)) {
            const [nx, ny] = nextCoord;
            
            // 检查新位置是否为空
            if (newGrid[ny][nx].value.eq(0)) {
              newX = nx;
              newY = ny;
              continue;
            }
            
            // 检查是否可以合并
            if (!merged && this.canMerge(newGrid[ny][nx], grid)) {
              const mergeResult = this.mergeTiles(
                newGrid[ny][nx], grid
              );
              grid = mergeResult;
              newX = nx;
              newY = ny;
              merged = true;
              if (this.bonusSteps === 0 && grid.value.gt(DC.D9E15)) {
                player.bonusTimes++;
                this.bonusSteps = 11;
                this.bonusExp = getBonusExp();
                if (this.negUnlocked) {
                  this.negBlockChance = getNegBlockChance();
                }
              }
              this.score = this.score.times(calculateScore(grid.value));
              moved = true;
            }
            break;
          }

          // 更新新网格
          newGrid[newY][newX] = grid;
          newTiles.push({
            id: this.nextId++,
            ...grid,
            x: newX,
            y: newY,
            merged
          });

          // 检查是否实际移动或合并
          if (newX !== x || newY !== y || merged) {
            moved = true;
          }
        }
      }

      if (moved) {
        this.grid = newGrid;
        this.tiles = newTiles;
        this.addRandomTile();
        if (this.score.gt(this.bestScore)) {
          this.bestScore = this.score;
        }
        this.updateAffordable();
        
        if (this.bonusSteps > 0) {
          this.bonusSteps--;
        }

        if (!this.hasAvailableMoves()) {
          this.gameOver = true;
        }
      }
    },

    // 修复后的坐标获取函数 - 确保不会返回负数
    getNextCoord(x, y, direction) {
      switch (direction) {
        case 0: return y > 0 ? [x, y - 1] : null; // 上
        case 1: return x < 3 ? [x + 1, y] : null;  // 右
        case 2: return y < 3 ? [x, y + 1] : null;  // 下
        case 3: return x > 0 ? [x - 1, y] : null;  // 左
      }
      return null;
    },

    canMerge(target, source) {
      if (source.type === T.NEG || target.type === T.NEG && source.type !== T.MUL) return true;
      // a merge to ^b -> a^b
      if (target.type === T.MUL && source.type === T.NUM) return true;
      return target.value.eq(source.value);
    },
    
    canMerge_noOrder(target, source) {
      return this.canMerge(target, source) || this.canMerge(source, target);
    },

    mergeTiles(target, source) {
      if (target.type === T.NEG) {
        if (source.type === T.NEG) {
          return {
            value: target.value.times(source.value),
            type: T.NUM
          }
        }
        if (source.type === T.NUM) {
          if (target.value.gt(source.value)) {
            return {
              value: target.value.div(source.value).floor(),
              type: T.NEG
            };
          }
          return {
            value: source.value.div(target.value).floor(),
            type: T.NUM
          };
        }
      }
      if (source.type === T.NEG) {
        if (target.type === T.NUM) {
          if (source.value.gt(target.value)) {
            return {
              value: source.value.div(target.value).floor(),
              type: T.NEG
            }
          }
          return {
            value: target.value.div(source.value).floor(),
            type: T.NUM
          }
        }
        return {
          value: source.value.times(target.value),
          type: T.NEG
        };
      }
      if (target.type === T.MUL) {
        return {
          value: source.value.times(target.value),
          type: source.type
        };
      }
      return {
        value: source.value.add(1),
        type: T.NUM
      };
    },

    hasAvailableMoves() {
      // 检查空格
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          if (this.grid[y][x].value.eq(0)) return true;
        }
      }

      // 检查可合并的相邻方块
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const grid = this.grid[y][x];
          
          // 检查右侧
          if (x < 3) {
            if (this.canMerge_noOrder(this.grid[y][x+1], grid)) return true;
          }
          
          // 检查下方
          if (y < 3) {
            if (this.canMerge_noOrder(this.grid[y+1][x], grid)) return true;
          }
        }
      }

      return this.clearTimes > 0 || this.someAffordable;
    },

    handleKeyDown(e) {
      if (this.gameOver) return;
      
      const keyMap = {
        'w': 0,
        'd': 1,
        's': 2,
        'a': 3
      };
      
      if (keyMap.hasOwnProperty(e.key)) {
        this.moveTiles(keyMap[e.key]);
      }
    },

    handleTouchStart(e) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    },

    handleTouchMove(e) {
      e.preventDefault();
    },

    handleTouchEnd(e) {
      if (this.gameOver) return;

      this.touchEndX = e.changedTouches[0].clientX;
      this.touchEndY = e.changedTouches[0].clientY;

      const dx = this.touchEndX - this.touchStartX;
      const dy = this.touchEndY - this.touchStartY;
      const minSwipeDistance = 30;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // 忽略过小的滑动
      if (Math.max(absDx, absDy) < minSwipeDistance) return;

      if (absDx > absDy) {
        // 水平滑动
        dx > 0 ? this.moveTiles(1) : this.moveTiles(3); // 右或左
      } else {
        // 垂直滑动
        dy > 0 ? this.moveTiles(2) : this.moveTiles(0); // 下或上
      }
    },
    
    getClass(value, type) {
      if (type === T.NEG) {
        return "tile-bh";
      }
      if (value.lt(DC.D9E15)) {
        return "tile-" + ((value.toNumber() - 1) % 11 + 1);
      }
      return "tile-NaN";
    },
    
    buyPowChance() {
      Upgrades.powChance.purchase();
      this.updateUpgrades();
    },
    
    buyBaseBlock() {
      Upgrades.baseBlock.purchase();
      this.updateUpgrades();
    },
    keepMax() {
      if (this.clearTimes <= 0) return;
      const max = this.grid.reduce((a, b) => Decimal.max(a, b.reduce((c, d) => Decimal.max(c, d.value), DC.D0)),  DC.D0);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const grid = this.grid[i][j];
          if (grid.value.neq(max) || grid.type !== T.NUM) {
            if (this.over1000) {
              this.score = this.score.mul(calculateScore(grid.value));
            }
            this.grid[i][j] = { value: DC.D0, type: T.NUM };
          }
        }
      }
      this.tiles = this.tiles.filter(x => x.value.eq(max) && x.type === T.NUM);
      this.clearTimes--;
      if (this.negUnlocked) {
        player.bonusTimes = 67;
        this.negBlockChance = getNegBlockChance();
        if (this.tiles.length === 0) {
          this.canFallVoid = true;
        }
      }
    },
    fallVoid() {
      if (!this.canFallVoid) return;
      player.grid = defaultGrid();
      this.score = DC.D1;
      player.score = DC.D1;
      Upgrades.powChance.reset();
      Upgrades.baseBlock.reset();
      player.bonusSteps = 0;
      player.bonusTimes = 0;
      player.clearTimes = 0;
      player.voidPoints = player.voidPoints.add(1);
      this.canFallVoid = false;
      this.initGame();
    },
    styleObject(x, y) {
      return {
        left: `${x * 22 + 6}%`,
        top: `${y * 22 + 6}%`
      };
    }
  }
});