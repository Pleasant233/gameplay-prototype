// 沿用远端80地块、10系列与70条升级关系。
(function(root){ const catalog={
  "values": [
    1,
    5,
    12,
    24,
    40
  ],
  "families": [
    {
      "key": "desert",
      "name": "沙漠",
      "color": "#D59D54",
      "role": "水源润沙",
      "baseTag": "干旱地表",
      "roots": [
        [
          "污染沙地",
          [
            0,
            -1,
            0,
            2,
            0
          ]
        ],
        [
          "沙丘",
          [
            1,
            0,
            0,
            3,
            1
          ]
        ]
      ],
      "art": "暖沙大色面、圆润沙丘，少量仙人掌",
      "branches": [
        {
          "key": "A",
          "name": "熔炼",
          "names": [
            "热砂丘",
            "赤晶沙漠",
            "曜金沙海"
          ],
          "attrs": [
            [
              3,
              0,
              0,
              6,
              3
            ],
            [
              7,
              0,
              0,
              11,
              6
            ],
            [
              12,
              0,
              0,
              18,
              10
            ]
          ],
          "effect": "水源润沙：每个相邻海洋／河谷地块，在轮末使本格水 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "干旱地表",
          "art": "少量金色矿晶与暖色炉岩"
        },
        {
          "key": "B",
          "name": "绿洲",
          "names": [
            "浅泉绿洲",
            "葱茏绿洲",
            "繁生绿洲"
          ],
          "attrs": [
            [
              1,
              3,
              4,
              3,
              1
            ],
            [
              2,
              6,
              8,
              4,
              4
            ],
            [
              3,
              10,
              14,
              5,
              8
            ]
          ],
          "effect": "水源润沙：每个相邻海洋／河谷地块，在轮末使本格水 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "水域、可耕地",
          "art": "一个清水池与绿色岸带"
        }
      ]
    },
    {
      "key": "woodland",
      "name": "林地",
      "color": "#619A64",
      "role": "活水育林",
      "baseTag": "林地",
      "roots": [
        [
          "腐化枯林",
          [
            0,
            -1,
            0,
            0,
            2
          ]
        ],
        [
          "疏林",
          [
            0,
            2,
            1,
            0,
            2
          ]
        ]
      ],
      "art": "少量大块圆树冠、柔和苔绿地面",
      "branches": [
        {
          "key": "A",
          "name": "林木",
          "names": [
            "幼木林",
            "丰木林",
            "巨木森林"
          ],
          "attrs": [
            [
              0,
              6,
              1,
              0,
              5
            ],
            [
              0,
              12,
              3,
              0,
              9
            ],
            [
              1,
              20,
              5,
              1,
              13
            ]
          ],
          "effect": "活水育林：每个相邻湿地／河谷地块，在轮末使本格木 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "林地",
          "art": "粗树干与厚实树冠，木段作为大形"
        },
        {
          "key": "B",
          "name": "栖兽",
          "names": [
            "林荫地",
            "栖兽密林",
            "古树生境"
          ],
          "attrs": [
            [
              0,
              4,
              2,
              0,
              6
            ],
            [
              1,
              8,
              5,
              0,
              10
            ],
            [
              2,
              13,
              8,
              1,
              16
            ]
          ],
          "effect": "活水育林：每个相邻湿地／河谷地块，在轮末使本格木 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "林地",
          "art": "树荫与一小片动物栖居空地"
        }
      ]
    },
    {
      "key": "ice",
      "name": "冰原",
      "color": "#78AFC6",
      "role": "地热融雪",
      "baseTag": "冻结地表",
      "roots": [
        [
          "冻土原",
          [
            0,
            0,
            1,
            0,
            0
          ]
        ],
        [
          "冻原",
          [
            1,
            0,
            3,
            0,
            1
          ]
        ]
      ],
      "art": "浅蓝大冰面、少量雪丘；用低火表现寒冷",
      "branches": [
        {
          "key": "A",
          "name": "防灾",
          "names": [
            "晶霜原",
            "冰壁原",
            "永冻冰原"
          ],
          "attrs": [
            [
              3,
              0,
              7,
              0,
              2
            ],
            [
              6,
              1,
              13,
              0,
              4
            ],
            [
              10,
              1,
              20,
              0,
              9
            ]
          ],
          "effect": "地热融雪：每个相邻火山地块，在轮末使本格水 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "冻结地表",
          "art": "平滑冰壁与一块保护冰晶"
        },
        {
          "key": "B",
          "name": "拆晶",
          "names": [
            "藏晶原",
            "晶湖冰原",
            "星晶冰原"
          ],
          "attrs": [
            [
              1,
              2,
              5,
              0,
              4
            ],
            [
              2,
              5,
              10,
              0,
              7
            ],
            [
              3,
              8,
              17,
              0,
              12
            ]
          ],
          "effect": "地热融雪：每个相邻火山地块，在轮末使本格水 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "冻结地表；融水需泉眼/小湖",
          "art": "几块宽大冰晶与平静的晶核"
        }
      ]
    },
    {
      "key": "ocean",
      "name": "海洋",
      "color": "#4E99B3",
      "role": "汇流入海",
      "baseTag": "水域",
      "roots": [
        [
          "污浊浅海",
          [
            0,
            -1,
            2,
            0,
            0
          ]
        ],
        [
          "浅海",
          [
            1,
            1,
            3,
            0,
            0
          ]
        ]
      ],
      "art": "清蓝水面、柔和浅岸与少量圆珊瑚",
      "branches": [
        {
          "key": "A",
          "name": "海产",
          "names": [
            "珊瑚海",
            "丰饶海",
            "生命海域"
          ],
          "attrs": [
            [
              2,
              2,
              7,
              0,
              1
            ],
            [
              4,
              4,
              13,
              0,
              3
            ],
            [
              7,
              6,
              21,
              0,
              6
            ]
          ],
          "effect": "汇流入海：每个相邻冰原／河谷地块，在轮末使本格水 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "水域",
          "art": "简约珊瑚礁与一个鱼群符号"
        },
        {
          "key": "B",
          "name": "航道",
          "names": [
            "潮道海",
            "环流海",
            "星潮海域"
          ],
          "attrs": [
            [
              4,
              1,
              6,
              0,
              1
            ],
            [
              8,
              2,
              12,
              0,
              2
            ],
            [
              13,
              3,
              20,
              0,
              4
            ]
          ],
          "effect": "汇流入海：每个相邻冰原／河谷地块，在轮末使本格水 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "水域",
          "art": "宽缓环流水带与少量导流岩"
        }
      ]
    },
    {
      "key": "grassland",
      "name": "草原",
      "color": "#93AA55",
      "role": "林岸沃野",
      "baseTag": "可耕地",
      "roots": [
        [
          "枯草原",
          [
            0,
            1,
            0,
            0,
            0
          ]
        ],
        [
          "草原",
          [
            0,
            1,
            1,
            0,
            3
          ]
        ]
      ],
      "art": "开阔草色平面、少量草簇与宽田垄",
      "branches": [
        {
          "key": "A",
          "name": "农耕",
          "names": [
            "嫩禾田原",
            "丰产田原",
            "黄金沃野"
          ],
          "attrs": [
            [
              0,
              3,
              2,
              1,
              6
            ],
            [
              1,
              5,
              4,
              2,
              12
            ],
            [
              2,
              8,
              7,
              3,
              20
            ]
          ],
          "effect": "林岸沃野：每个相邻林地／河谷地块，在轮末使本格土 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "可耕地",
          "art": "几行整齐作物，避免密集穗叶"
        },
        {
          "key": "B",
          "name": "牧场",
          "names": [
            "繁草牧原",
            "百兽牧原",
            "共生牧野"
          ],
          "attrs": [
            [
              0,
              4,
              2,
              1,
              5
            ],
            [
              1,
              9,
              4,
              2,
              8
            ],
            [
              2,
              15,
              7,
              3,
              13
            ]
          ],
          "effect": "林岸沃野：每个相邻林地／河谷地块，在轮末使本格土 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "可耕地",
          "art": "开阔牧地与简单木栏轮廓"
        }
      ]
    },
    {
      "key": "wetland",
      "name": "湿地",
      "color": "#5D9B8C",
      "role": "水草净泽",
      "baseTag": "水域、可耕地",
      "roots": [
        [
          "污泥滩",
          [
            0,
            -1,
            1,
            0,
            1
          ]
        ],
        [
          "芦苇湿地",
          [
            0,
            1,
            2,
            0,
            2
          ]
        ]
      ],
      "art": "浅水大色块、圆泥岸与少量芦苇",
      "branches": [
        {
          "key": "A",
          "name": "净污",
          "names": [
            "净水泽",
            "清流湿地",
            "澄明水泽"
          ],
          "attrs": [
            [
              0,
              3,
              5,
              0,
              4
            ],
            [
              1,
              6,
              10,
              0,
              7
            ],
            [
              2,
              9,
              17,
              0,
              12
            ]
          ],
          "effect": "水草净泽：每个相邻海洋／草原地块，在轮末使本格木 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "水域、可耕地",
          "art": "少量净水植物与清浊过渡"
        },
        {
          "key": "B",
          "name": "回收",
          "names": [
            "逆晶泥沼",
            "净晶湿地",
            "复原晶泽"
          ],
          "attrs": [
            [
              1,
              2,
              5,
              1,
              3
            ],
            [
              3,
              4,
              10,
              2,
              5
            ],
            [
              5,
              7,
              16,
              3,
              9
            ]
          ],
          "effect": "水草净泽：每个相邻海洋／草原地块，在轮末使本格木 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "水域、可耕地",
          "art": "一小块暗紫泥晶与绿色复原晶"
        }
      ]
    },
    {
      "key": "river",
      "name": "河谷",
      "color": "#5AABB0",
      "role": "涵养溪流",
      "baseTag": "水域、可耕地",
      "roots": [
        [
          "细溪谷",
          [
            0,
            0,
            1,
            0,
            0
          ]
        ],
        [
          "溪谷",
          [
            0,
            1,
            3,
            0,
            1
          ]
        ]
      ],
      "art": "一条宽缓溪流与浅色河岸",
      "branches": [
        {
          "key": "A",
          "name": "灌溉",
          "names": [
            "灌渠河谷",
            "织水河谷",
            "万川河谷"
          ],
          "attrs": [
            [
              0,
              2,
              6,
              0,
              4
            ],
            [
              1,
              5,
              11,
              0,
              7
            ],
            [
              2,
              8,
              18,
              0,
              12
            ]
          ],
          "effect": "涵养溪流：每个相邻冰原／林地地块，在轮末使本格水 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "水域、可耕地",
          "art": "简单分水渠与开阔农岸"
        },
        {
          "key": "B",
          "name": "养分",
          "names": [
            "沃岸河谷",
            "沉积河谷",
            "丰壤河谷"
          ],
          "attrs": [
            [
              0,
              4,
              5,
              0,
              3
            ],
            [
              1,
              8,
              9,
              0,
              6
            ],
            [
              2,
              13,
              15,
              0,
              10
            ]
          ],
          "effect": "涵养溪流：每个相邻冰原／林地地块，在轮末使本格水 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "水域、可耕地",
          "art": "宽阔沉积土岸与少量绿植"
        }
      ]
    },
    {
      "key": "mine",
      "name": "矿山",
      "color": "#8D91A1",
      "role": "冷热凝脉",
      "baseTag": "岩脉",
      "roots": [
        [
          "碎矿地",
          [
            1,
            0,
            0,
            0,
            0
          ]
        ],
        [
          "岩地",
          [
            3,
            0,
            0,
            1,
            1
          ]
        ]
      ],
      "art": "大块圆岩与少量可识别矿脉",
      "branches": [
        {
          "key": "A",
          "name": "工业",
          "names": [
            "铜铁岩山",
            "铸材矿山",
            "巨脉矿山"
          ],
          "attrs": [
            [
              6,
              0,
              1,
              2,
              3
            ],
            [
              12,
              0,
              2,
              4,
              6
            ],
            [
              20,
              0,
              4,
              6,
              10
            ]
          ],
          "effect": "冷热凝脉：每个相邻火山／冰原地块，在轮末使本格金 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "可产矿",
          "art": "矿口木架与几块铜铁色岩晶"
        },
        {
          "key": "B",
          "name": "稀矿",
          "names": [
            "银晶岩山",
            "金银矿山",
            "辉金山脉"
          ],
          "attrs": [
            [
              7,
              0,
              1,
              1,
              3
            ],
            [
              14,
              0,
              2,
              2,
              6
            ],
            [
              21,
              0,
              4,
              4,
              11
            ]
          ],
          "effect": "冷热凝脉：每个相邻火山／冰原地块，在轮末使本格金 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "可产矿",
          "art": "少量大金银矿晶，保留岩面留白"
        }
      ]
    },
    {
      "key": "volcano",
      "name": "火山",
      "color": "#CB805F",
      "role": "岩砂蓄火",
      "baseTag": "熔岩基底",
      "roots": [
        [
          "冷灰坡",
          [
            0,
            0,
            0,
            1,
            0
          ]
        ],
        [
          "火山丘",
          [
            1,
            0,
            0,
            3,
            1
          ]
        ]
      ],
      "art": "大火山轮廓与一条温暖熔岩线",
      "branches": [
        {
          "key": "A",
          "name": "熔火",
          "names": [
            "熔火丘",
            "赤焰火山",
            "烈曜火山"
          ],
          "attrs": [
            [
              3,
              0,
              0,
              7,
              2
            ],
            [
              6,
              0,
              0,
              14,
              4
            ],
            [
              11,
              0,
              0,
              21,
              8
            ]
          ],
          "effect": "岩砂蓄火：每个相邻矿山／沙漠地块，在轮末使本格火 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "熔岩，不提供天然水域/耕田",
          "art": "圆润熔岩口与克制橙色光"
        },
        {
          "key": "B",
          "name": "沃灰",
          "names": [
            "温灰坡",
            "沃灰丘原",
            "丰壤火原"
          ],
          "attrs": [
            [
              1,
              1,
              0,
              6,
              4
            ],
            [
              2,
              3,
              1,
              10,
              8
            ],
            [
              4,
              6,
              2,
              16,
              12
            ]
          ],
          "effect": "岩砂蓄火：每个相邻矿山／沙漠地块，在轮末使本格火 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "可耕地、已冷却；无天然水域",
          "art": "暖灰土坡与少量新芽"
        }
      ]
    },
    {
      "key": "ruins",
      "name": "遗迹",
      "color": "#A58D6B",
      "role": "林岩护址",
      "baseTag": "旧址",
      "roots": [
        [
          "破败城镇",
          [
            0,
            1,
            0,
            0,
            0
          ]
        ],
        [
          "修复旧址",
          [
            1,
            1,
            1,
            0,
            2
          ]
        ]
      ],
      "art": "几面简洁旧石墙、圆柱与少量新绿",
      "branches": [
        {
          "key": "A",
          "name": "工坊",
          "names": [
            "匠作遗址",
            "工坊旧城",
            "贤者工坊"
          ],
          "attrs": [
            [
              3,
              2,
              2,
              1,
              4
            ],
            [
              6,
              4,
              4,
              2,
              8
            ],
            [
              10,
              6,
              6,
              4,
              14
            ]
          ],
          "effect": "林岩护址：每个相邻矿山／林地地块，在轮末使本格土 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "旧址",
          "art": "简约木石工坊与一个工具符号"
        },
        {
          "key": "B",
          "name": "结界",
          "names": [
            "残垣阵址",
            "护境遗址",
            "守星古城"
          ],
          "attrs": [
            [
              2,
              3,
              3,
              1,
              3
            ],
            [
              4,
              6,
              6,
              2,
              6
            ],
            [
              7,
              10,
              10,
              3,
              10
            ]
          ],
          "effect": "林岩护址：每个相邻矿山／林地地块，在轮末使本格土 +1。",
          "params": [
            "属性 +1",
            "属性 +2",
            "属性 +3"
          ],
          "cost": "无需材料",
          "trigger": "四邻互作",
          "limit": "受属性上限约束",
          "tag": "旧址",
          "art": "少量石阵与一枚盾核"
        }
      ]
    }
  ],
  "nodes": [
    {
      "id": "desert_t1",
      "family": "desert",
      "familyName": "沙漠",
      "level": 1,
      "name": "污染沙地",
      "attrs": [
        0,
        -1,
        0,
        2,
        0
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": null,
      "requiredN": 1,
      "effect": "水源润沙：每个相邻海洋／河谷地块，在轮末使本格水 +1。",
      "tag": "干旱地表；不提供天然水域/耕田",
      "art": "暖沙大色面、圆润沙丘，少量仙人掌",
      "look": "pollute_earth",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "desert_t2",
      "family": "desert",
      "familyName": "沙漠",
      "level": 2,
      "name": "沙丘",
      "attrs": [
        1,
        0,
        0,
        3,
        1
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": "desert_t1",
      "requiredN": 1,
      "effect": "水源润沙：每个相邻海洋／河谷地块，在轮末使本格水 +1。",
      "tag": "干旱地表；不提供天然水域/耕田",
      "art": "暖沙大色面、圆润沙丘，少量仙人掌",
      "look": "sand",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "desert_a_t3",
      "family": "desert",
      "familyName": "沙漠",
      "level": 3,
      "name": "热砂丘",
      "attrs": [
        3,
        0,
        0,
        6,
        3
      ],
      "branch": "熔炼",
      "branchKey": "A",
      "parent": "desert_t2",
      "requiredN": 1,
      "effect": "水源润沙：每个相邻海洋／河谷地块，在轮末使本格水 +1。",
      "tag": "干旱地表",
      "art": "暖沙大色面、圆润沙丘，少量仙人掌；少量金色矿晶与暖色炉岩",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "sand"
    },
    {
      "id": "desert_a_t4",
      "family": "desert",
      "familyName": "沙漠",
      "level": 4,
      "name": "赤晶沙漠",
      "attrs": [
        7,
        0,
        0,
        11,
        6
      ],
      "branch": "熔炼",
      "branchKey": "A",
      "parent": "desert_a_t3",
      "requiredN": 2,
      "effect": "水源润沙：每个相邻海洋／河谷地块，在轮末使本格水 +2。",
      "tag": "干旱地表",
      "art": "暖沙大色面、圆润沙丘，少量仙人掌；少量金色矿晶与暖色炉岩",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "sand"
    },
    {
      "id": "desert_a_t5",
      "family": "desert",
      "familyName": "沙漠",
      "level": 5,
      "name": "曜金沙海",
      "attrs": [
        12,
        0,
        0,
        18,
        10
      ],
      "branch": "熔炼",
      "branchKey": "A",
      "parent": "desert_a_t4",
      "requiredN": 5,
      "effect": "水源润沙：每个相邻海洋／河谷地块，在轮末使本格水 +3。",
      "tag": "干旱地表",
      "art": "暖沙大色面、圆润沙丘，少量仙人掌；少量金色矿晶与暖色炉岩",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "sand"
    },
    {
      "id": "desert_b_t3",
      "family": "desert",
      "familyName": "沙漠",
      "level": 3,
      "name": "浅泉绿洲",
      "attrs": [
        1,
        3,
        4,
        3,
        1
      ],
      "branch": "绿洲",
      "branchKey": "B",
      "parent": "desert_t2",
      "requiredN": 1,
      "effect": "水源润沙：每个相邻海洋／河谷地块，在轮末使本格水 +1。",
      "tag": "水域、可耕地",
      "art": "暖沙大色面、圆润沙丘，少量仙人掌；一个清水池与绿色岸带",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "wet"
    },
    {
      "id": "desert_b_t4",
      "family": "desert",
      "familyName": "沙漠",
      "level": 4,
      "name": "葱茏绿洲",
      "attrs": [
        2,
        6,
        8,
        4,
        4
      ],
      "branch": "绿洲",
      "branchKey": "B",
      "parent": "desert_b_t3",
      "requiredN": 2,
      "effect": "水源润沙：每个相邻海洋／河谷地块，在轮末使本格水 +2。",
      "tag": "水域、可耕地",
      "art": "暖沙大色面、圆润沙丘，少量仙人掌；一个清水池与绿色岸带",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "wet"
    },
    {
      "id": "desert_b_t5",
      "family": "desert",
      "familyName": "沙漠",
      "level": 5,
      "name": "繁生绿洲",
      "attrs": [
        3,
        10,
        14,
        5,
        8
      ],
      "branch": "绿洲",
      "branchKey": "B",
      "parent": "desert_b_t4",
      "requiredN": 5,
      "effect": "水源润沙：每个相邻海洋／河谷地块，在轮末使本格水 +3。",
      "tag": "水域、可耕地",
      "art": "暖沙大色面、圆润沙丘，少量仙人掌；一个清水池与绿色岸带",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "wet"
    },
    {
      "id": "woodland_t1",
      "family": "woodland",
      "familyName": "林地",
      "level": 1,
      "name": "腐化枯林",
      "attrs": [
        0,
        -1,
        0,
        0,
        2
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": null,
      "requiredN": 1,
      "effect": "活水育林：每个相邻湿地／河谷地块，在轮末使本格木 +1。",
      "tag": "林地；天然不带水域/耕田标签",
      "art": "少量大块圆树冠、柔和苔绿地面",
      "look": "pollute_earth",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "woodland_t2",
      "family": "woodland",
      "familyName": "林地",
      "level": 2,
      "name": "疏林",
      "attrs": [
        0,
        2,
        1,
        0,
        2
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": "woodland_t1",
      "requiredN": 1,
      "effect": "活水育林：每个相邻湿地／河谷地块，在轮末使本格木 +1。",
      "tag": "林地；天然不带水域/耕田标签",
      "art": "少量大块圆树冠、柔和苔绿地面",
      "look": "forest",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "woodland_a_t3",
      "family": "woodland",
      "familyName": "林地",
      "level": 3,
      "name": "幼木林",
      "attrs": [
        0,
        6,
        1,
        0,
        5
      ],
      "branch": "林木",
      "branchKey": "A",
      "parent": "woodland_t2",
      "requiredN": 1,
      "effect": "活水育林：每个相邻湿地／河谷地块，在轮末使本格木 +1。",
      "tag": "林地",
      "art": "少量大块圆树冠、柔和苔绿地面；粗树干与厚实树冠，木段作为大形",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "forest"
    },
    {
      "id": "woodland_a_t4",
      "family": "woodland",
      "familyName": "林地",
      "level": 4,
      "name": "丰木林",
      "attrs": [
        0,
        12,
        3,
        0,
        9
      ],
      "branch": "林木",
      "branchKey": "A",
      "parent": "woodland_a_t3",
      "requiredN": 2,
      "effect": "活水育林：每个相邻湿地／河谷地块，在轮末使本格木 +2。",
      "tag": "林地",
      "art": "少量大块圆树冠、柔和苔绿地面；粗树干与厚实树冠，木段作为大形",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "forest"
    },
    {
      "id": "woodland_a_t5",
      "family": "woodland",
      "familyName": "林地",
      "level": 5,
      "name": "巨木森林",
      "attrs": [
        1,
        20,
        5,
        1,
        13
      ],
      "branch": "林木",
      "branchKey": "A",
      "parent": "woodland_a_t4",
      "requiredN": 5,
      "effect": "活水育林：每个相邻湿地／河谷地块，在轮末使本格木 +3。",
      "tag": "林地",
      "art": "少量大块圆树冠、柔和苔绿地面；粗树干与厚实树冠，木段作为大形",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "forest"
    },
    {
      "id": "woodland_b_t3",
      "family": "woodland",
      "familyName": "林地",
      "level": 3,
      "name": "林荫地",
      "attrs": [
        0,
        4,
        2,
        0,
        6
      ],
      "branch": "栖兽",
      "branchKey": "B",
      "parent": "woodland_t2",
      "requiredN": 1,
      "effect": "活水育林：每个相邻湿地／河谷地块，在轮末使本格木 +1。",
      "tag": "林地",
      "art": "少量大块圆树冠、柔和苔绿地面；树荫与一小片动物栖居空地",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "rain"
    },
    {
      "id": "woodland_b_t4",
      "family": "woodland",
      "familyName": "林地",
      "level": 4,
      "name": "栖兽密林",
      "attrs": [
        1,
        8,
        5,
        0,
        10
      ],
      "branch": "栖兽",
      "branchKey": "B",
      "parent": "woodland_b_t3",
      "requiredN": 2,
      "effect": "活水育林：每个相邻湿地／河谷地块，在轮末使本格木 +2。",
      "tag": "林地",
      "art": "少量大块圆树冠、柔和苔绿地面；树荫与一小片动物栖居空地",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "rain"
    },
    {
      "id": "woodland_b_t5",
      "family": "woodland",
      "familyName": "林地",
      "level": 5,
      "name": "古树生境",
      "attrs": [
        2,
        13,
        8,
        1,
        16
      ],
      "branch": "栖兽",
      "branchKey": "B",
      "parent": "woodland_b_t4",
      "requiredN": 5,
      "effect": "活水育林：每个相邻湿地／河谷地块，在轮末使本格木 +3。",
      "tag": "林地",
      "art": "少量大块圆树冠、柔和苔绿地面；树荫与一小片动物栖居空地",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "rain"
    },
    {
      "id": "ice_t1",
      "family": "ice",
      "familyName": "冰原",
      "level": 1,
      "name": "冻土原",
      "attrs": [
        0,
        0,
        1,
        0,
        0
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": null,
      "requiredN": 1,
      "effect": "地热融雪：每个相邻火山地块，在轮末使本格水 +1。",
      "tag": "冻结地表；冰面不算活水，泉眼/小湖可形成融水区",
      "art": "浅蓝大冰面、少量雪丘；用低火表现寒冷",
      "look": "peak",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "ice_t2",
      "family": "ice",
      "familyName": "冰原",
      "level": 2,
      "name": "冻原",
      "attrs": [
        1,
        0,
        3,
        0,
        1
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": "ice_t1",
      "requiredN": 1,
      "effect": "地热融雪：每个相邻火山地块，在轮末使本格水 +1。",
      "tag": "冻结地表；冰面不算活水，泉眼/小湖可形成融水区",
      "art": "浅蓝大冰面、少量雪丘；用低火表现寒冷",
      "look": "peak",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "ice_a_t3",
      "family": "ice",
      "familyName": "冰原",
      "level": 3,
      "name": "晶霜原",
      "attrs": [
        3,
        0,
        7,
        0,
        2
      ],
      "branch": "防灾",
      "branchKey": "A",
      "parent": "ice_t2",
      "requiredN": 1,
      "effect": "地热融雪：每个相邻火山地块，在轮末使本格水 +1。",
      "tag": "冻结地表",
      "art": "浅蓝大冰面、少量雪丘；用低火表现寒冷；平滑冰壁与一块保护冰晶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "peak"
    },
    {
      "id": "ice_a_t4",
      "family": "ice",
      "familyName": "冰原",
      "level": 4,
      "name": "冰壁原",
      "attrs": [
        6,
        1,
        13,
        0,
        4
      ],
      "branch": "防灾",
      "branchKey": "A",
      "parent": "ice_a_t3",
      "requiredN": 3,
      "effect": "地热融雪：每个相邻火山地块，在轮末使本格水 +2。",
      "tag": "冻结地表",
      "art": "浅蓝大冰面、少量雪丘；用低火表现寒冷；平滑冰壁与一块保护冰晶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "peak"
    },
    {
      "id": "ice_a_t5",
      "family": "ice",
      "familyName": "冰原",
      "level": 5,
      "name": "永冻冰原",
      "attrs": [
        10,
        1,
        20,
        0,
        9
      ],
      "branch": "防灾",
      "branchKey": "A",
      "parent": "ice_a_t4",
      "requiredN": 5,
      "effect": "地热融雪：每个相邻火山地块，在轮末使本格水 +3。",
      "tag": "冻结地表",
      "art": "浅蓝大冰面、少量雪丘；用低火表现寒冷；平滑冰壁与一块保护冰晶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "peak"
    },
    {
      "id": "ice_b_t3",
      "family": "ice",
      "familyName": "冰原",
      "level": 3,
      "name": "藏晶原",
      "attrs": [
        1,
        2,
        5,
        0,
        4
      ],
      "branch": "拆晶",
      "branchKey": "B",
      "parent": "ice_t2",
      "requiredN": 1,
      "effect": "地热融雪：每个相邻火山地块，在轮末使本格水 +1。",
      "tag": "冻结地表；融水需泉眼/小湖",
      "art": "浅蓝大冰面、少量雪丘；用低火表现寒冷；几块宽大冰晶与平静的晶核",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "peak"
    },
    {
      "id": "ice_b_t4",
      "family": "ice",
      "familyName": "冰原",
      "level": 4,
      "name": "晶湖冰原",
      "attrs": [
        2,
        5,
        10,
        0,
        7
      ],
      "branch": "拆晶",
      "branchKey": "B",
      "parent": "ice_b_t3",
      "requiredN": 2,
      "effect": "地热融雪：每个相邻火山地块，在轮末使本格水 +2。",
      "tag": "冻结地表；融水需泉眼/小湖",
      "art": "浅蓝大冰面、少量雪丘；用低火表现寒冷；几块宽大冰晶与平静的晶核",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "peak"
    },
    {
      "id": "ice_b_t5",
      "family": "ice",
      "familyName": "冰原",
      "level": 5,
      "name": "星晶冰原",
      "attrs": [
        3,
        8,
        17,
        0,
        12
      ],
      "branch": "拆晶",
      "branchKey": "B",
      "parent": "ice_b_t4",
      "requiredN": 5,
      "effect": "地热融雪：每个相邻火山地块，在轮末使本格水 +3。",
      "tag": "冻结地表；融水需泉眼/小湖",
      "art": "浅蓝大冰面、少量雪丘；用低火表现寒冷；几块宽大冰晶与平静的晶核",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "peak"
    },
    {
      "id": "ocean_t1",
      "family": "ocean",
      "familyName": "海洋",
      "level": 1,
      "name": "污浊浅海",
      "attrs": [
        0,
        -1,
        2,
        0,
        0
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": null,
      "requiredN": 1,
      "effect": "汇流入海：每个相邻冰原／河谷地块，在轮末使本格水 +1。",
      "tag": "水域；水>0时可养鱼/水草，默认无耕田",
      "art": "清蓝水面、柔和浅岸与少量圆珊瑚",
      "look": "pollute_water",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "ocean_t2",
      "family": "ocean",
      "familyName": "海洋",
      "level": 2,
      "name": "浅海",
      "attrs": [
        1,
        1,
        3,
        0,
        0
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": "ocean_t1",
      "requiredN": 1,
      "effect": "汇流入海：每个相邻冰原／河谷地块，在轮末使本格水 +1。",
      "tag": "水域；水>0时可养鱼/水草，默认无耕田",
      "art": "清蓝水面、柔和浅岸与少量圆珊瑚",
      "look": "water",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "ocean_a_t3",
      "family": "ocean",
      "familyName": "海洋",
      "level": 3,
      "name": "珊瑚海",
      "attrs": [
        2,
        2,
        7,
        0,
        1
      ],
      "branch": "海产",
      "branchKey": "A",
      "parent": "ocean_t2",
      "requiredN": 1,
      "effect": "汇流入海：每个相邻冰原／河谷地块，在轮末使本格水 +1。",
      "tag": "水域",
      "art": "清蓝水面、柔和浅岸与少量圆珊瑚；简约珊瑚礁与一个鱼群符号",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "water"
    },
    {
      "id": "ocean_a_t4",
      "family": "ocean",
      "familyName": "海洋",
      "level": 4,
      "name": "丰饶海",
      "attrs": [
        4,
        4,
        13,
        0,
        3
      ],
      "branch": "海产",
      "branchKey": "A",
      "parent": "ocean_a_t3",
      "requiredN": 3,
      "effect": "汇流入海：每个相邻冰原／河谷地块，在轮末使本格水 +2。",
      "tag": "水域",
      "art": "清蓝水面、柔和浅岸与少量圆珊瑚；简约珊瑚礁与一个鱼群符号",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "water"
    },
    {
      "id": "ocean_a_t5",
      "family": "ocean",
      "familyName": "海洋",
      "level": 5,
      "name": "生命海域",
      "attrs": [
        7,
        6,
        21,
        0,
        6
      ],
      "branch": "海产",
      "branchKey": "A",
      "parent": "ocean_a_t4",
      "requiredN": 5,
      "effect": "汇流入海：每个相邻冰原／河谷地块，在轮末使本格水 +3。",
      "tag": "水域",
      "art": "清蓝水面、柔和浅岸与少量圆珊瑚；简约珊瑚礁与一个鱼群符号",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "water"
    },
    {
      "id": "ocean_b_t3",
      "family": "ocean",
      "familyName": "海洋",
      "level": 3,
      "name": "潮道海",
      "attrs": [
        4,
        1,
        6,
        0,
        1
      ],
      "branch": "航道",
      "branchKey": "B",
      "parent": "ocean_t2",
      "requiredN": 1,
      "effect": "汇流入海：每个相邻冰原／河谷地块，在轮末使本格水 +1。",
      "tag": "水域",
      "art": "清蓝水面、柔和浅岸与少量圆珊瑚；宽缓环流水带与少量导流岩",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "water"
    },
    {
      "id": "ocean_b_t4",
      "family": "ocean",
      "familyName": "海洋",
      "level": 4,
      "name": "环流海",
      "attrs": [
        8,
        2,
        12,
        0,
        2
      ],
      "branch": "航道",
      "branchKey": "B",
      "parent": "ocean_b_t3",
      "requiredN": 2,
      "effect": "汇流入海：每个相邻冰原／河谷地块，在轮末使本格水 +2。",
      "tag": "水域",
      "art": "清蓝水面、柔和浅岸与少量圆珊瑚；宽缓环流水带与少量导流岩",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "water"
    },
    {
      "id": "ocean_b_t5",
      "family": "ocean",
      "familyName": "海洋",
      "level": 5,
      "name": "星潮海域",
      "attrs": [
        13,
        3,
        20,
        0,
        4
      ],
      "branch": "航道",
      "branchKey": "B",
      "parent": "ocean_b_t4",
      "requiredN": 5,
      "effect": "汇流入海：每个相邻冰原／河谷地块，在轮末使本格水 +3。",
      "tag": "水域",
      "art": "清蓝水面、柔和浅岸与少量圆珊瑚；宽缓环流水带与少量导流岩",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "water"
    },
    {
      "id": "grassland_t1",
      "family": "grassland",
      "familyName": "草原",
      "level": 1,
      "name": "枯草原",
      "attrs": [
        0,
        1,
        0,
        0,
        0
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": null,
      "requiredN": 1,
      "effect": "林岸沃野：每个相邻林地／河谷地块，在轮末使本格土 +1。",
      "tag": "可耕地；生成仍须满足植物/动物属性门槛",
      "art": "开阔草色平面、少量草簇与宽田垄",
      "look": "grass",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "grassland_t2",
      "family": "grassland",
      "familyName": "草原",
      "level": 2,
      "name": "草原",
      "attrs": [
        0,
        1,
        1,
        0,
        3
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": "grassland_t1",
      "requiredN": 1,
      "effect": "林岸沃野：每个相邻林地／河谷地块，在轮末使本格土 +1。",
      "tag": "可耕地；生成仍须满足植物/动物属性门槛",
      "art": "开阔草色平面、少量草簇与宽田垄",
      "look": "grass",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "grassland_a_t3",
      "family": "grassland",
      "familyName": "草原",
      "level": 3,
      "name": "嫩禾田原",
      "attrs": [
        0,
        3,
        2,
        1,
        6
      ],
      "branch": "农耕",
      "branchKey": "A",
      "parent": "grassland_t2",
      "requiredN": 1,
      "effect": "林岸沃野：每个相邻林地／河谷地块，在轮末使本格土 +1。",
      "tag": "可耕地",
      "art": "开阔草色平面、少量草簇与宽田垄；几行整齐作物，避免密集穗叶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "fertile"
    },
    {
      "id": "grassland_a_t4",
      "family": "grassland",
      "familyName": "草原",
      "level": 4,
      "name": "丰产田原",
      "attrs": [
        1,
        5,
        4,
        2,
        12
      ],
      "branch": "农耕",
      "branchKey": "A",
      "parent": "grassland_a_t3",
      "requiredN": 2,
      "effect": "林岸沃野：每个相邻林地／河谷地块，在轮末使本格土 +2。",
      "tag": "可耕地",
      "art": "开阔草色平面、少量草簇与宽田垄；几行整齐作物，避免密集穗叶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "fertile"
    },
    {
      "id": "grassland_a_t5",
      "family": "grassland",
      "familyName": "草原",
      "level": 5,
      "name": "黄金沃野",
      "attrs": [
        2,
        8,
        7,
        3,
        20
      ],
      "branch": "农耕",
      "branchKey": "A",
      "parent": "grassland_a_t4",
      "requiredN": 5,
      "effect": "林岸沃野：每个相邻林地／河谷地块，在轮末使本格土 +3。",
      "tag": "可耕地",
      "art": "开阔草色平面、少量草簇与宽田垄；几行整齐作物，避免密集穗叶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "fertile"
    },
    {
      "id": "grassland_b_t3",
      "family": "grassland",
      "familyName": "草原",
      "level": 3,
      "name": "繁草牧原",
      "attrs": [
        0,
        4,
        2,
        1,
        5
      ],
      "branch": "牧场",
      "branchKey": "B",
      "parent": "grassland_t2",
      "requiredN": 1,
      "effect": "林岸沃野：每个相邻林地／河谷地块，在轮末使本格土 +1。",
      "tag": "可耕地",
      "art": "开阔草色平面、少量草簇与宽田垄；开阔牧地与简单木栏轮廓",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "grass"
    },
    {
      "id": "grassland_b_t4",
      "family": "grassland",
      "familyName": "草原",
      "level": 4,
      "name": "百兽牧原",
      "attrs": [
        1,
        9,
        4,
        2,
        8
      ],
      "branch": "牧场",
      "branchKey": "B",
      "parent": "grassland_b_t3",
      "requiredN": 2,
      "effect": "林岸沃野：每个相邻林地／河谷地块，在轮末使本格土 +2。",
      "tag": "可耕地",
      "art": "开阔草色平面、少量草簇与宽田垄；开阔牧地与简单木栏轮廓",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "grass"
    },
    {
      "id": "grassland_b_t5",
      "family": "grassland",
      "familyName": "草原",
      "level": 5,
      "name": "共生牧野",
      "attrs": [
        2,
        15,
        7,
        3,
        13
      ],
      "branch": "牧场",
      "branchKey": "B",
      "parent": "grassland_b_t4",
      "requiredN": 5,
      "effect": "林岸沃野：每个相邻林地／河谷地块，在轮末使本格土 +3。",
      "tag": "可耕地",
      "art": "开阔草色平面、少量草簇与宽田垄；开阔牧地与简单木栏轮廓",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "grass"
    },
    {
      "id": "wetland_t1",
      "family": "wetland",
      "familyName": "湿地",
      "level": 1,
      "name": "污泥滩",
      "attrs": [
        0,
        -1,
        1,
        0,
        1
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": null,
      "requiredN": 1,
      "effect": "水草净泽：每个相邻海洋／草原地块，在轮末使本格木 +1。",
      "tag": "水域、可耕地；少量泥滩与芦苇",
      "art": "浅水大色块、圆泥岸与少量芦苇",
      "look": "pollute_water",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "wetland_t2",
      "family": "wetland",
      "familyName": "湿地",
      "level": 2,
      "name": "芦苇湿地",
      "attrs": [
        0,
        1,
        2,
        0,
        2
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": "wetland_t1",
      "requiredN": 1,
      "effect": "水草净泽：每个相邻海洋／草原地块，在轮末使本格木 +1。",
      "tag": "水域、可耕地；少量泥滩与芦苇",
      "art": "浅水大色块、圆泥岸与少量芦苇",
      "look": "wet",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "wetland_a_t3",
      "family": "wetland",
      "familyName": "湿地",
      "level": 3,
      "name": "净水泽",
      "attrs": [
        0,
        3,
        5,
        0,
        4
      ],
      "branch": "净污",
      "branchKey": "A",
      "parent": "wetland_t2",
      "requiredN": 1,
      "effect": "水草净泽：每个相邻海洋／草原地块，在轮末使本格木 +1。",
      "tag": "水域、可耕地",
      "art": "浅水大色块、圆泥岸与少量芦苇；少量净水植物与清浊过渡",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "wet"
    },
    {
      "id": "wetland_a_t4",
      "family": "wetland",
      "familyName": "湿地",
      "level": 4,
      "name": "清流湿地",
      "attrs": [
        1,
        6,
        10,
        0,
        7
      ],
      "branch": "净污",
      "branchKey": "A",
      "parent": "wetland_a_t3",
      "requiredN": 2,
      "effect": "水草净泽：每个相邻海洋／草原地块，在轮末使本格木 +2。",
      "tag": "水域、可耕地",
      "art": "浅水大色块、圆泥岸与少量芦苇；少量净水植物与清浊过渡",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "wet"
    },
    {
      "id": "wetland_a_t5",
      "family": "wetland",
      "familyName": "湿地",
      "level": 5,
      "name": "澄明水泽",
      "attrs": [
        2,
        9,
        17,
        0,
        12
      ],
      "branch": "净污",
      "branchKey": "A",
      "parent": "wetland_a_t4",
      "requiredN": 5,
      "effect": "水草净泽：每个相邻海洋／草原地块，在轮末使本格木 +3。",
      "tag": "水域、可耕地",
      "art": "浅水大色块、圆泥岸与少量芦苇；少量净水植物与清浊过渡",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "wet"
    },
    {
      "id": "wetland_b_t3",
      "family": "wetland",
      "familyName": "湿地",
      "level": 3,
      "name": "逆晶泥沼",
      "attrs": [
        1,
        2,
        5,
        1,
        3
      ],
      "branch": "回收",
      "branchKey": "B",
      "parent": "wetland_t2",
      "requiredN": 1,
      "effect": "水草净泽：每个相邻海洋／草原地块，在轮末使本格木 +1。",
      "tag": "水域、可耕地",
      "art": "浅水大色块、圆泥岸与少量芦苇；一小块暗紫泥晶与绿色复原晶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "wet"
    },
    {
      "id": "wetland_b_t4",
      "family": "wetland",
      "familyName": "湿地",
      "level": 4,
      "name": "净晶湿地",
      "attrs": [
        3,
        4,
        10,
        2,
        5
      ],
      "branch": "回收",
      "branchKey": "B",
      "parent": "wetland_b_t3",
      "requiredN": 2,
      "effect": "水草净泽：每个相邻海洋／草原地块，在轮末使本格木 +2。",
      "tag": "水域、可耕地",
      "art": "浅水大色块、圆泥岸与少量芦苇；一小块暗紫泥晶与绿色复原晶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "wet"
    },
    {
      "id": "wetland_b_t5",
      "family": "wetland",
      "familyName": "湿地",
      "level": 5,
      "name": "复原晶泽",
      "attrs": [
        5,
        7,
        16,
        3,
        9
      ],
      "branch": "回收",
      "branchKey": "B",
      "parent": "wetland_b_t4",
      "requiredN": 5,
      "effect": "水草净泽：每个相邻海洋／草原地块，在轮末使本格木 +3。",
      "tag": "水域、可耕地",
      "art": "浅水大色块、圆泥岸与少量芦苇；一小块暗紫泥晶与绿色复原晶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "wet"
    },
    {
      "id": "river_t1",
      "family": "river",
      "familyName": "河谷",
      "level": 1,
      "name": "细溪谷",
      "attrs": [
        0,
        0,
        1,
        0,
        0
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": null,
      "requiredN": 1,
      "effect": "涵养溪流：每个相邻冰原／林地地块，在轮末使本格水 +1。",
      "tag": "水域、可耕地；连续河道可拼接",
      "art": "一条宽缓溪流与浅色河岸",
      "look": "valley",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "river_t2",
      "family": "river",
      "familyName": "河谷",
      "level": 2,
      "name": "溪谷",
      "attrs": [
        0,
        1,
        3,
        0,
        1
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": "river_t1",
      "requiredN": 1,
      "effect": "涵养溪流：每个相邻冰原／林地地块，在轮末使本格水 +1。",
      "tag": "水域、可耕地；连续河道可拼接",
      "art": "一条宽缓溪流与浅色河岸",
      "look": "valley",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "river_a_t3",
      "family": "river",
      "familyName": "河谷",
      "level": 3,
      "name": "灌渠河谷",
      "attrs": [
        0,
        2,
        6,
        0,
        4
      ],
      "branch": "灌溉",
      "branchKey": "A",
      "parent": "river_t2",
      "requiredN": 1,
      "effect": "涵养溪流：每个相邻冰原／林地地块，在轮末使本格水 +1。",
      "tag": "水域、可耕地",
      "art": "一条宽缓溪流与浅色河岸；简单分水渠与开阔农岸",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "valley"
    },
    {
      "id": "river_a_t4",
      "family": "river",
      "familyName": "河谷",
      "level": 4,
      "name": "织水河谷",
      "attrs": [
        1,
        5,
        11,
        0,
        7
      ],
      "branch": "灌溉",
      "branchKey": "A",
      "parent": "river_a_t3",
      "requiredN": 2,
      "effect": "涵养溪流：每个相邻冰原／林地地块，在轮末使本格水 +2。",
      "tag": "水域、可耕地",
      "art": "一条宽缓溪流与浅色河岸；简单分水渠与开阔农岸",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "valley"
    },
    {
      "id": "river_a_t5",
      "family": "river",
      "familyName": "河谷",
      "level": 5,
      "name": "万川河谷",
      "attrs": [
        2,
        8,
        18,
        0,
        12
      ],
      "branch": "灌溉",
      "branchKey": "A",
      "parent": "river_a_t4",
      "requiredN": 5,
      "effect": "涵养溪流：每个相邻冰原／林地地块，在轮末使本格水 +3。",
      "tag": "水域、可耕地",
      "art": "一条宽缓溪流与浅色河岸；简单分水渠与开阔农岸",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "valley"
    },
    {
      "id": "river_b_t3",
      "family": "river",
      "familyName": "河谷",
      "level": 3,
      "name": "沃岸河谷",
      "attrs": [
        0,
        4,
        5,
        0,
        3
      ],
      "branch": "养分",
      "branchKey": "B",
      "parent": "river_t2",
      "requiredN": 1,
      "effect": "涵养溪流：每个相邻冰原／林地地块，在轮末使本格水 +1。",
      "tag": "水域、可耕地",
      "art": "一条宽缓溪流与浅色河岸；宽阔沉积土岸与少量绿植",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "valley"
    },
    {
      "id": "river_b_t4",
      "family": "river",
      "familyName": "河谷",
      "level": 4,
      "name": "沉积河谷",
      "attrs": [
        1,
        8,
        9,
        0,
        6
      ],
      "branch": "养分",
      "branchKey": "B",
      "parent": "river_b_t3",
      "requiredN": 2,
      "effect": "涵养溪流：每个相邻冰原／林地地块，在轮末使本格水 +2。",
      "tag": "水域、可耕地",
      "art": "一条宽缓溪流与浅色河岸；宽阔沉积土岸与少量绿植",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "valley"
    },
    {
      "id": "river_b_t5",
      "family": "river",
      "familyName": "河谷",
      "level": 5,
      "name": "丰壤河谷",
      "attrs": [
        2,
        13,
        15,
        0,
        10
      ],
      "branch": "养分",
      "branchKey": "B",
      "parent": "river_b_t4",
      "requiredN": 5,
      "effect": "涵养溪流：每个相邻冰原／林地地块，在轮末使本格水 +3。",
      "tag": "水域、可耕地",
      "art": "一条宽缓溪流与浅色河岸；宽阔沉积土岸与少量绿植",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "valley"
    },
    {
      "id": "mine_t1",
      "family": "mine",
      "familyName": "矿山",
      "level": 1,
      "name": "碎矿地",
      "attrs": [
        1,
        0,
        0,
        0,
        0
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": null,
      "requiredN": 1,
      "effect": "冷热凝脉：每个相邻火山／冰原地块，在轮末使本格金 +1。",
      "tag": "岩脉",
      "art": "大块圆岩与少量可识别矿脉",
      "look": "mine",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "mine_t2",
      "family": "mine",
      "familyName": "矿山",
      "level": 2,
      "name": "岩地",
      "attrs": [
        3,
        0,
        0,
        1,
        1
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": "mine_t1",
      "requiredN": 1,
      "effect": "冷热凝脉：每个相邻火山／冰原地块，在轮末使本格金 +1。",
      "tag": "岩脉",
      "art": "大块圆岩与少量可识别矿脉",
      "look": "mine",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "mine_a_t3",
      "family": "mine",
      "familyName": "矿山",
      "level": 3,
      "name": "铜铁岩山",
      "attrs": [
        6,
        0,
        1,
        2,
        3
      ],
      "branch": "工业",
      "branchKey": "A",
      "parent": "mine_t2",
      "requiredN": 1,
      "effect": "冷热凝脉：每个相邻火山／冰原地块，在轮末使本格金 +1。",
      "tag": "岩脉",
      "art": "大块圆岩与少量可识别矿脉；矿口木架与几块铜铁色岩晶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "mine"
    },
    {
      "id": "mine_a_t4",
      "family": "mine",
      "familyName": "矿山",
      "level": 4,
      "name": "铸材矿山",
      "attrs": [
        12,
        0,
        2,
        4,
        6
      ],
      "branch": "工业",
      "branchKey": "A",
      "parent": "mine_a_t3",
      "requiredN": 2,
      "effect": "冷热凝脉：每个相邻火山／冰原地块，在轮末使本格金 +2。",
      "tag": "岩脉",
      "art": "大块圆岩与少量可识别矿脉；矿口木架与几块铜铁色岩晶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "mine"
    },
    {
      "id": "mine_a_t5",
      "family": "mine",
      "familyName": "矿山",
      "level": 5,
      "name": "巨脉矿山",
      "attrs": [
        20,
        0,
        4,
        6,
        10
      ],
      "branch": "工业",
      "branchKey": "A",
      "parent": "mine_a_t4",
      "requiredN": 5,
      "effect": "冷热凝脉：每个相邻火山／冰原地块，在轮末使本格金 +3。",
      "tag": "岩脉",
      "art": "大块圆岩与少量可识别矿脉；矿口木架与几块铜铁色岩晶",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "mine"
    },
    {
      "id": "mine_b_t3",
      "family": "mine",
      "familyName": "矿山",
      "level": 3,
      "name": "银晶岩山",
      "attrs": [
        7,
        0,
        1,
        1,
        3
      ],
      "branch": "稀矿",
      "branchKey": "B",
      "parent": "mine_t2",
      "requiredN": 1,
      "effect": "冷热凝脉：每个相邻火山／冰原地块，在轮末使本格金 +1。",
      "tag": "岩脉",
      "art": "大块圆岩与少量可识别矿脉；少量大金银矿晶，保留岩面留白",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "mine"
    },
    {
      "id": "mine_b_t4",
      "family": "mine",
      "familyName": "矿山",
      "level": 4,
      "name": "金银矿山",
      "attrs": [
        14,
        0,
        2,
        2,
        6
      ],
      "branch": "稀矿",
      "branchKey": "B",
      "parent": "mine_b_t3",
      "requiredN": 3,
      "effect": "冷热凝脉：每个相邻火山／冰原地块，在轮末使本格金 +2。",
      "tag": "岩脉",
      "art": "大块圆岩与少量可识别矿脉；少量大金银矿晶，保留岩面留白",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "mine"
    },
    {
      "id": "mine_b_t5",
      "family": "mine",
      "familyName": "矿山",
      "level": 5,
      "name": "辉金山脉",
      "attrs": [
        21,
        0,
        4,
        4,
        11
      ],
      "branch": "稀矿",
      "branchKey": "B",
      "parent": "mine_b_t4",
      "requiredN": 5,
      "effect": "冷热凝脉：每个相邻火山／冰原地块，在轮末使本格金 +3。",
      "tag": "岩脉",
      "art": "大块圆岩与少量可识别矿脉；少量大金银矿晶，保留岩面留白",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "mine"
    },
    {
      "id": "volcano_t1",
      "family": "volcano",
      "familyName": "火山",
      "level": 1,
      "name": "冷灰坡",
      "attrs": [
        0,
        0,
        0,
        1,
        0
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": null,
      "requiredN": 1,
      "effect": "岩砂蓄火：每个相邻矿山／沙漠地块，在轮末使本格火 +1。",
      "tag": "熔岩基底",
      "art": "大火山轮廓与一条温暖熔岩线",
      "look": "lava",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "volcano_t2",
      "family": "volcano",
      "familyName": "火山",
      "level": 2,
      "name": "火山丘",
      "attrs": [
        1,
        0,
        0,
        3,
        1
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": "volcano_t1",
      "requiredN": 1,
      "effect": "岩砂蓄火：每个相邻矿山／沙漠地块，在轮末使本格火 +1。",
      "tag": "熔岩基底",
      "art": "大火山轮廓与一条温暖熔岩线",
      "look": "lava",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "volcano_a_t3",
      "family": "volcano",
      "familyName": "火山",
      "level": 3,
      "name": "熔火丘",
      "attrs": [
        3,
        0,
        0,
        7,
        2
      ],
      "branch": "熔火",
      "branchKey": "A",
      "parent": "volcano_t2",
      "requiredN": 1,
      "effect": "岩砂蓄火：每个相邻矿山／沙漠地块，在轮末使本格火 +1。",
      "tag": "熔岩基底",
      "art": "大火山轮廓与一条温暖熔岩线；圆润熔岩口与克制橙色光",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "lava"
    },
    {
      "id": "volcano_a_t4",
      "family": "volcano",
      "familyName": "火山",
      "level": 4,
      "name": "赤焰火山",
      "attrs": [
        6,
        0,
        0,
        14,
        4
      ],
      "branch": "熔火",
      "branchKey": "A",
      "parent": "volcano_a_t3",
      "requiredN": 3,
      "effect": "岩砂蓄火：每个相邻矿山／沙漠地块，在轮末使本格火 +2。",
      "tag": "熔岩基底",
      "art": "大火山轮廓与一条温暖熔岩线；圆润熔岩口与克制橙色光",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "lava"
    },
    {
      "id": "volcano_a_t5",
      "family": "volcano",
      "familyName": "火山",
      "level": 5,
      "name": "烈曜火山",
      "attrs": [
        11,
        0,
        0,
        21,
        8
      ],
      "branch": "熔火",
      "branchKey": "A",
      "parent": "volcano_a_t4",
      "requiredN": 5,
      "effect": "岩砂蓄火：每个相邻矿山／沙漠地块，在轮末使本格火 +3。",
      "tag": "熔岩基底",
      "art": "大火山轮廓与一条温暖熔岩线；圆润熔岩口与克制橙色光",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "lava"
    },
    {
      "id": "volcano_b_t3",
      "family": "volcano",
      "familyName": "火山",
      "level": 3,
      "name": "温灰坡",
      "attrs": [
        1,
        1,
        0,
        6,
        4
      ],
      "branch": "沃灰",
      "branchKey": "B",
      "parent": "volcano_t2",
      "requiredN": 1,
      "effect": "岩砂蓄火：每个相邻矿山／沙漠地块，在轮末使本格火 +1。",
      "tag": "可耕地、已冷却；无天然水域",
      "art": "大火山轮廓与一条温暖熔岩线；暖灰土坡与少量新芽",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "barren"
    },
    {
      "id": "volcano_b_t4",
      "family": "volcano",
      "familyName": "火山",
      "level": 4,
      "name": "沃灰丘原",
      "attrs": [
        2,
        3,
        1,
        10,
        8
      ],
      "branch": "沃灰",
      "branchKey": "B",
      "parent": "volcano_b_t3",
      "requiredN": 2,
      "effect": "岩砂蓄火：每个相邻矿山／沙漠地块，在轮末使本格火 +2。",
      "tag": "可耕地、已冷却；无天然水域",
      "art": "大火山轮廓与一条温暖熔岩线；暖灰土坡与少量新芽",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "barren"
    },
    {
      "id": "volcano_b_t5",
      "family": "volcano",
      "familyName": "火山",
      "level": 5,
      "name": "丰壤火原",
      "attrs": [
        4,
        6,
        2,
        16,
        12
      ],
      "branch": "沃灰",
      "branchKey": "B",
      "parent": "volcano_b_t4",
      "requiredN": 5,
      "effect": "岩砂蓄火：每个相邻矿山／沙漠地块，在轮末使本格火 +3。",
      "tag": "可耕地、已冷却；无天然水域",
      "art": "大火山轮廓与一条温暖熔岩线；暖灰土坡与少量新芽",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "barren"
    },
    {
      "id": "ruins_t1",
      "family": "ruins",
      "familyName": "遗迹",
      "level": 1,
      "name": "破败城镇",
      "attrs": [
        0,
        1,
        0,
        0,
        0
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": null,
      "requiredN": 1,
      "effect": "林岩护址：每个相邻矿山／林地地块，在轮末使本格土 +1。",
      "tag": "旧址；天然不带水域/耕田/产矿标签",
      "art": "几面简洁旧石墙、圆柱与少量新绿",
      "look": "ruin",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "ruins_t2",
      "family": "ruins",
      "familyName": "遗迹",
      "level": 2,
      "name": "修复旧址",
      "attrs": [
        1,
        1,
        1,
        0,
        2
      ],
      "branch": "共用主干",
      "branchKey": "root",
      "parent": "ruins_t1",
      "requiredN": 1,
      "effect": "林岩护址：每个相邻矿山／林地地块，在轮末使本格土 +1。",
      "tag": "旧址；天然不带水域/耕田/产矿标签",
      "art": "几面简洁旧石墙、圆柱与少量新绿",
      "look": "ruin",
      "trigger": "每轮结束，四邻互作",
      "cost": "不消耗结晶或行动点",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算"
    },
    {
      "id": "ruins_a_t3",
      "family": "ruins",
      "familyName": "遗迹",
      "level": 3,
      "name": "匠作遗址",
      "attrs": [
        3,
        2,
        2,
        1,
        4
      ],
      "branch": "工坊",
      "branchKey": "A",
      "parent": "ruins_t2",
      "requiredN": 1,
      "effect": "林岩护址：每个相邻矿山／林地地块，在轮末使本格土 +1。",
      "tag": "旧址",
      "art": "几面简洁旧石墙、圆柱与少量新绿；简约木石工坊与一个工具符号",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "ruin"
    },
    {
      "id": "ruins_a_t4",
      "family": "ruins",
      "familyName": "遗迹",
      "level": 4,
      "name": "工坊旧城",
      "attrs": [
        6,
        4,
        4,
        2,
        8
      ],
      "branch": "工坊",
      "branchKey": "A",
      "parent": "ruins_a_t3",
      "requiredN": 2,
      "effect": "林岩护址：每个相邻矿山／林地地块，在轮末使本格土 +2。",
      "tag": "旧址",
      "art": "几面简洁旧石墙、圆柱与少量新绿；简约木石工坊与一个工具符号",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "ruin"
    },
    {
      "id": "ruins_a_t5",
      "family": "ruins",
      "familyName": "遗迹",
      "level": 5,
      "name": "贤者工坊",
      "attrs": [
        10,
        6,
        6,
        4,
        14
      ],
      "branch": "工坊",
      "branchKey": "A",
      "parent": "ruins_a_t4",
      "requiredN": 5,
      "effect": "林岩护址：每个相邻矿山／林地地块，在轮末使本格土 +3。",
      "tag": "旧址",
      "art": "几面简洁旧石墙、圆柱与少量新绿；简约木石工坊与一个工具符号",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "ruin"
    },
    {
      "id": "ruins_b_t3",
      "family": "ruins",
      "familyName": "遗迹",
      "level": 3,
      "name": "残垣阵址",
      "attrs": [
        2,
        3,
        3,
        1,
        3
      ],
      "branch": "结界",
      "branchKey": "B",
      "parent": "ruins_t2",
      "requiredN": 1,
      "effect": "林岩护址：每个相邻矿山／林地地块，在轮末使本格土 +1。",
      "tag": "旧址",
      "art": "几面简洁旧石墙、圆柱与少量新绿；少量石阵与一枚盾核",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "ruin"
    },
    {
      "id": "ruins_b_t4",
      "family": "ruins",
      "familyName": "遗迹",
      "level": 4,
      "name": "护境遗址",
      "attrs": [
        4,
        6,
        6,
        2,
        6
      ],
      "branch": "结界",
      "branchKey": "B",
      "parent": "ruins_b_t3",
      "requiredN": 2,
      "effect": "林岩护址：每个相邻矿山／林地地块，在轮末使本格土 +2。",
      "tag": "旧址",
      "art": "几面简洁旧石墙、圆柱与少量新绿；少量石阵与一枚盾核",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "ruin"
    },
    {
      "id": "ruins_b_t5",
      "family": "ruins",
      "familyName": "遗迹",
      "level": 5,
      "name": "守星古城",
      "attrs": [
        7,
        10,
        10,
        3,
        10
      ],
      "branch": "结界",
      "branchKey": "B",
      "parent": "ruins_b_t4",
      "requiredN": 5,
      "effect": "林岩护址：每个相邻矿山／林地地块，在轮末使本格土 +3。",
      "tag": "旧址",
      "art": "几面简洁旧石墙、圆柱与少量新绿；少量石阵与一枚盾核",
      "cost": "不消耗结晶或行动点",
      "trigger": "每轮结束，四邻互作",
      "limit": "只作用于本格，受同系列连片属性上限约束，不连锁结算",
      "look": "ruin"
    }
  ],
  "edges": [
    [
      "desert_t1",
      "desert_t2"
    ],
    [
      "desert_t2",
      "desert_a_t3"
    ],
    [
      "desert_a_t3",
      "desert_a_t4"
    ],
    [
      "desert_a_t4",
      "desert_a_t5"
    ],
    [
      "desert_t2",
      "desert_b_t3"
    ],
    [
      "desert_b_t3",
      "desert_b_t4"
    ],
    [
      "desert_b_t4",
      "desert_b_t5"
    ],
    [
      "woodland_t1",
      "woodland_t2"
    ],
    [
      "woodland_t2",
      "woodland_a_t3"
    ],
    [
      "woodland_a_t3",
      "woodland_a_t4"
    ],
    [
      "woodland_a_t4",
      "woodland_a_t5"
    ],
    [
      "woodland_t2",
      "woodland_b_t3"
    ],
    [
      "woodland_b_t3",
      "woodland_b_t4"
    ],
    [
      "woodland_b_t4",
      "woodland_b_t5"
    ],
    [
      "ice_t1",
      "ice_t2"
    ],
    [
      "ice_t2",
      "ice_a_t3"
    ],
    [
      "ice_a_t3",
      "ice_a_t4"
    ],
    [
      "ice_a_t4",
      "ice_a_t5"
    ],
    [
      "ice_t2",
      "ice_b_t3"
    ],
    [
      "ice_b_t3",
      "ice_b_t4"
    ],
    [
      "ice_b_t4",
      "ice_b_t5"
    ],
    [
      "ocean_t1",
      "ocean_t2"
    ],
    [
      "ocean_t2",
      "ocean_a_t3"
    ],
    [
      "ocean_a_t3",
      "ocean_a_t4"
    ],
    [
      "ocean_a_t4",
      "ocean_a_t5"
    ],
    [
      "ocean_t2",
      "ocean_b_t3"
    ],
    [
      "ocean_b_t3",
      "ocean_b_t4"
    ],
    [
      "ocean_b_t4",
      "ocean_b_t5"
    ],
    [
      "grassland_t1",
      "grassland_t2"
    ],
    [
      "grassland_t2",
      "grassland_a_t3"
    ],
    [
      "grassland_a_t3",
      "grassland_a_t4"
    ],
    [
      "grassland_a_t4",
      "grassland_a_t5"
    ],
    [
      "grassland_t2",
      "grassland_b_t3"
    ],
    [
      "grassland_b_t3",
      "grassland_b_t4"
    ],
    [
      "grassland_b_t4",
      "grassland_b_t5"
    ],
    [
      "wetland_t1",
      "wetland_t2"
    ],
    [
      "wetland_t2",
      "wetland_a_t3"
    ],
    [
      "wetland_a_t3",
      "wetland_a_t4"
    ],
    [
      "wetland_a_t4",
      "wetland_a_t5"
    ],
    [
      "wetland_t2",
      "wetland_b_t3"
    ],
    [
      "wetland_b_t3",
      "wetland_b_t4"
    ],
    [
      "wetland_b_t4",
      "wetland_b_t5"
    ],
    [
      "river_t1",
      "river_t2"
    ],
    [
      "river_t2",
      "river_a_t3"
    ],
    [
      "river_a_t3",
      "river_a_t4"
    ],
    [
      "river_a_t4",
      "river_a_t5"
    ],
    [
      "river_t2",
      "river_b_t3"
    ],
    [
      "river_b_t3",
      "river_b_t4"
    ],
    [
      "river_b_t4",
      "river_b_t5"
    ],
    [
      "mine_t1",
      "mine_t2"
    ],
    [
      "mine_t2",
      "mine_a_t3"
    ],
    [
      "mine_a_t3",
      "mine_a_t4"
    ],
    [
      "mine_a_t4",
      "mine_a_t5"
    ],
    [
      "mine_t2",
      "mine_b_t3"
    ],
    [
      "mine_b_t3",
      "mine_b_t4"
    ],
    [
      "mine_b_t4",
      "mine_b_t5"
    ],
    [
      "volcano_t1",
      "volcano_t2"
    ],
    [
      "volcano_t2",
      "volcano_a_t3"
    ],
    [
      "volcano_a_t3",
      "volcano_a_t4"
    ],
    [
      "volcano_a_t4",
      "volcano_a_t5"
    ],
    [
      "volcano_t2",
      "volcano_b_t3"
    ],
    [
      "volcano_b_t3",
      "volcano_b_t4"
    ],
    [
      "volcano_b_t4",
      "volcano_b_t5"
    ],
    [
      "ruins_t1",
      "ruins_t2"
    ],
    [
      "ruins_t2",
      "ruins_a_t3"
    ],
    [
      "ruins_a_t3",
      "ruins_a_t4"
    ],
    [
      "ruins_a_t4",
      "ruins_a_t5"
    ],
    [
      "ruins_t2",
      "ruins_b_t3"
    ],
    [
      "ruins_b_t3",
      "ruins_b_t4"
    ],
    [
      "ruins_b_t4",
      "ruins_b_t5"
    ]
  ]
}; if(typeof module!=="undefined"&&module.exports)module.exports=catalog;else root.TerrainCatalog=catalog;})(this);
