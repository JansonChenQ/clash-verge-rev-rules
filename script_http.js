// Define main function (script entry)
// function main(config, profileName) {
//   return config;
// }

// DNS配置
const dnsConfig = {
  // 开关，true表示启用Clash的DNS处理器
  enable: true,
  // 主DNS服务器组，用于解析国内域名，以获取最快的CDN节点。
  // 使用加密DNS (DoH/DoT) 可以防止ISP的DNS污染。
  nameserver: [
    "https://dns.alidns.com/dns-query", // 阿里DNS (DoH)
    "https://doh.pub/dns-query", // 腾讯DNSPod (DoH)
    "tls://223.5.5.5:853", // 阿里DNS (DoT)
  ],
  // 备用DNS服务器组。当主DNS解析结果不理想（如被污染或IP归属地非中国）时，
  // Clash会使用此组DNS进行再次查询，以获取真实、无污染的海外IP。
  fallback: [
    "https://dns.google/dns-query", // Google DNS (DoH)
    "https://1.1.1.1/dns-query", // Cloudflare DNS (DoH)
    "tls://8.8.4.4:853", // Google DNS (DoT)
  ],
};

// 代理组通用配置
const groupBaseOption = {
  interval: 300,
  timeout: 1800,
  url: "http://www.gstatic.com/generate_204",
  lazy: true, // 分组首次被实际使用（即有网络请求通过它）时或者当用户手动触发延迟测试时，才会进行一次测速,如果分组少可以改成false或者在对应分组中覆盖此配置
  "max-failed-times": 3,
  hidden: false,
  interval: 120, // 测速间隔，单位秒
  tolerance: 60, //容差,它的主要作用是 防止因网络波动导致代理节点频繁切换，增加稳定性,单位是毫秒
};

// 自动测速配置
const groupBaseAutoTest = {
  ...groupBaseOption,
  lazy: false,
};

// 规则集通用配置
const ruleProviderCommon = {
  type: "http",
  format: "yaml",
  interval: 86400,
};

// 规则集配置
const ruleProviders = {
  ai: {
    ...ruleProviderCommon,
    behavior: "classical",
    type: "http",
    url: "https://raw.githubusercontent.com/klierx/clash-verge-rev-rules/refs/heads/master/ruleset/ai.yaml",
  },
  github: {
    ...ruleProviderCommon,
    behavior: "classical",
    type: "http",
    url: "https://raw.githubusercontent.com/klierx/clash-verge-rev-rules/refs/heads/master/ruleset/github.yaml",
  },
  telegram: {
    ...ruleProviderCommon,
    behavior: "classical",
    type: "http",
    url: "https://raw.githubusercontent.com/klierx/clash-verge-rev-rules/refs/heads/master/ruleset/telegram.yaml",
  },
  media: {
    ...ruleProviderCommon,
    behavior: "classical",
    type: "http",
    url: "https://raw.githubusercontent.com/klierx/clash-verge-rev-rules/refs/heads/master/ruleset/media.yaml",
  },
  global: {
    ...ruleProviderCommon,
    behavior: "classical",
    type: "http",
    url: "https://raw.githubusercontent.com/klierx/clash-verge-rev-rules/refs/heads/master/ruleset/global.yaml",
  },
};

// 规则
const rules = [
  // =================== 👇 在这里插入你的自定义规则 👇 ===================
  
  // DOMAIN-SUFFIX: 匹配域名后缀（最常用，匹配 xxx.com 及其所有子域名）
  "DOMAIN-SUFFIX,example.com,🌍 国外",
  "DOMAIN-SUFFIX,notion.so,美国-自动", 

  // DOMAIN-KEYWORD: 匹配域名中的关键字
  "DOMAIN-KEYWORD,company-internal,DIRECT",

  // DOMAIN: 精确匹配完整域名（不包含子域名）
  "DOMAIN,www.specific-website.com,港台日新韩-自动",

  // IP-CIDR: 匹配指定的 IP 段 (如果是内网IP，记得加上 no-resolve 防止触发 DNS 解析)
  "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
  "IP-CIDR,8.8.8.8/32,🌍 国外",

  // =================== 👆 自定义规则结束 👆 ===================
  "RULE-SET,ai,👽 AI",
  "RULE-SET,github,📘 GitHub",
  "RULE-SET,telegram,🙋 Telegram",
  "RULE-SET,media,📀 流媒体",
  "RULE-SET,global,🌍 国外",
  "MATCH,➡️ 国内",
];

// 程序入口
function main(config) {
  const proxyCount = config?.proxies?.length ?? 0;
  const proxyProviderCount =
    typeof config?.["proxy-providers"] === "object"
      ? Object.keys(config["proxy-providers"]).length
      : 0;
  if (proxyCount === 0 && proxyProviderCount === 0) {
    throw new Error("配置文件中未找到任何代理");
  }

  // 1. 定义前置节点组名称 (必须在下面 proxy-groups 中存在)
  const entranceGroupName = "港台日新韩-自动";

  // 2. 定义静态住宅 IP 节点，并直接绑定前置代理组
  const myStaticNode = {
    name: "🏠 静态住宅落地",
    type: "http",
    server: "",
    port: 5782,
    username: "test",
    password: "12345678",
    "skip-cert-verify": true,
    // 核心改动：在这里指定 dialer-proxy，实现链式代理
    "dialer-proxy": entranceGroupName,
  };

  // 3. 将静态住宅节点注入到 proxies 列表
  if (!config.proxies) {
    config.proxies = [];
  }
  // config.proxies.push(myStaticNode);

  // 4. 修改 DNS 配置
  config["dns"] = dnsConfig;

  // 5. 重新定义代理组
  config["proxy-groups"] = [
    // 住宅 IP 专用选择组
    // {
    //   ...groupBaseOption,
    //   name: "🔗 链式-住宅IP",
    //   type: "url-test",
    //   proxies: [myStaticNode.name], // 此时连接该节点会自动经过 entranceGroupName
    // },
    {
      ...groupBaseAutoTest,
      name: "所有-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
    },
    {
      ...groupBaseAutoTest,
      name: "港台日新韩马-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
      filter:
        "(广港|广台|广日|广新|广韩|广美|香港|HK|Hong Kong|🇭🇰|HongKong|台湾|TW|Tai Wan|🇹🇼|🇨🇳|TaiWan|Taiwan|日本|JP|川日|东京|大阪|泉日|埼玉|沪日|深日|🇯🇵|Japan|新加坡|SG|坡|狮城|🇸🇬|Singapore|韩国|KR|首尔|春川|🇰🇷|Korea|马来)",
    },
    {
      ...groupBaseAutoTest,
      name: "台日新韩-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
      filter:
        "(广台|广日|广新|广韩|广美|台湾|TW|Tai Wan|🇹🇼|🇨🇳|TaiWan|Taiwan|日本|JP|川日|东京|大阪|泉日|埼玉|沪日|深日|🇯🇵|Japan|新加坡|SG|坡|狮城|🇸🇬|Singapore|韩国|KR|首尔|春川|🇰🇷|Korea)",
    },
    {
      ...groupBaseAutoTest,
      name: "日新韩-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
      filter:
        "(广台|广日|广新|广韩|广美|日本|JP|川日|东京|大阪|泉日|埼玉|沪日|深日|🇯🇵|Japan|新加坡|SG|坡|狮城|🇸🇬|Singapore|韩国|KR|首尔|春川|🇰🇷|Korea)",
    },
    {
      ...groupBaseOption,
      name: "香港-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
      filter: "(广港|香港|HK|Hong Kong|🇭🇰|HongKong)",
    },
    {
      ...groupBaseOption,
      name: "台湾-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
      filter: "(广台|台湾|台灣|TW|Tai Wan|🇹🇼|🇨🇳|TaiWan|Taiwan)",
    },
    {
      ...groupBaseOption,
      name: "日本-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
      filter: "(广日|日本|JP|川日|东京|大阪|泉日|埼玉|沪日|深日|🇯🇵|Japan)",
    },
    {
      ...groupBaseOption,
      name: "新加坡-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
      filter: "(广新|新加坡|SG|坡|狮城|🇸🇬|Singapore)",
    },
    {
      ...groupBaseOption,
      name: "新马-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
      filter: "(广新|新加坡|SG|坡|狮城|🇸🇬|Singapore|马来)",
    },
    {
      ...groupBaseOption,
      name: "韩国-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
      filter: "(广韩|韩国|韓國|KR|首尔|春川|🇰🇷|Korea)",
    },
    {
      ...groupBaseAutoTest,
      name: "美国-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
      filter:
        "(广美|美|USA|纽约|波特兰|达拉斯|俄勒|凤凰城|费利蒙|硅谷|拉斯|洛杉|圣何塞|圣克拉|西雅|芝加|🇺🇸|United States)",
    },
    {
      ...groupBaseOption,
      name: "其他-自动",
      type: "url-test",
      proxies: [],
      "include-all": true,
      filter:
        "(波|柬|尼|也|克|比|尔|立|冰|秘|耳|利|埃|希|孟|芬|愛|澳|英|德|南|意|法|拿|墨|印|越|俄|瑞|智|荷|比|巴|沙|班|泰|德|烏|以|Australia|Konghwaguk)",
    },
    {
      ...groupBaseOption,
      name: "👽 AI",
      type: "select",
      proxies: [
        // "🔗 链式-住宅IP", 
        "日新韩-自动", 
        "美国-自动"],
    },
    {
      ...groupBaseOption,
      name: "📘 GitHub",
      type: "select",
      proxies: ["港台日新韩马-自动", "日新韩-自动", "美国-自动"],
    },
    {
      ...groupBaseOption,
      name: "🙋 Telegram",
      type: "select",
      proxies: ["港台日新韩马-自动", "日新韩-自动", "美国-自动"],
    },
    {
      ...groupBaseOption,
      name: "📀 流媒体",
      type: "select",
      proxies: ["港台日新韩马-自动", "日新韩-自动", "美国-自动"],
    },
    {
      ...groupBaseOption,
      name: "🌍 国外",
      type: "select",
      proxies: [
        // "🔗 链式-住宅IP",
        "港台日新韩马-自动",
        "日新韩-自动",
        "美国-自动",
      ],
    },
    {
      ...groupBaseOption,
      name: "➡️ 国内",
      type: "select",
      proxies: ["DIRECT", "所有-自动"],
    },
  ];

  // 6. 覆盖原配置中的规则
  config["rule-providers"] = ruleProviders;
  config["rules"] = rules;

  return config;
}