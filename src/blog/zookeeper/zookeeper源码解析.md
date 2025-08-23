---
icon: document
# 标题
title: 'zookeeper源码解析'
# 设置作者
author: Ms.Zyh
# 设置写作时间
date: 2022-05-28
# 一个页面可以有多个分类
category:
  - zookeeper
# 一个页面可以有多个标签
tag:
  - 必看
  - zookeeper
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在星标文章中
star: false
---

### 一，zookeeper源码解析

> 源码流程图：https://www.processon.com/embed/640ec2155476aa23907484f0

#### 1.1 程序入口

Zookeeper 服务的启动命令是 `zkServer.sh start`

zkServer.sh:

```sh
ZOOMAIN="org.apache.zookeeper.server.quorum.QuorumPeerMain"

if [ -e "$ZOOBIN/../libexec/zkEnv.sh" ]; then
  . "$ZOOBINDIR"/../libexec/zkEnv.sh
else
  . "$ZOOBINDIR"/zkEnv.sh
fi
```

zkEnv.sh中：

```sh
if [ "x$ZOOCFG" = "x" ]
then
    ZOOCFG="zoo.cfg"
fi
```

 `zkServer.sh start`底层的实际执行内容

```sh
nohup "$JAVA" $ZOO_DATADIR_AUTOCREATE "-Dzookeeper.log.dir=${ZOO_LOG_DIR}" \
    "-Dzookeeper.log.file=${ZOO_LOG_FILE}" "-Dzookeeper.root.logger=${ZOO_LOG4J_PROP}" \
    -XX:+HeapDumpOnOutOfMemoryError -XX:OnOutOfMemoryError='kill -9 %p' \
    -cp "$CLASSPATH" $JVMFLAGS $ZOOMAIN "$ZOOCFG" > "$_ZOO_DAEMON_OUT" 2>&1 < /dev/null
```

重点关注的是zkServer.sh的`ZOOMAIN="org.apache.zookeeper.server.quorum.QuorumPeerMain"`和zkEnv.sh中的`ZOOCFG="zoo.cfg"`，所以程序的入口是 QuorumPeerMain.java 类

`org.apache.zookeeper.server.quorum.QuorumPeerMain`：

```java
public static void main(String[] args) { // args 相当于提交参数中的 zoo.cfg
    // 创建了一个 zk 节点
	QuorumPeerMain main = new QuorumPeerMain();
	try {
        {
		 // 初始化节点并运行
		main.initializeAndRun(args);
	} catch (IllegalArgumentException e) {
		// 省略
	}
	LOG.info("Exiting normally");
	ServiceUtils.requestSystemExit(ExitCode.EXECUTION_FINISHED.getValue());
}
```

初始化节点并运行，跟进`main.initializeAndRun(args);`方法：

```java
protected void initializeAndRun(String[] args) throws ConfigException, IOException, AdminServerException {
    // 创建配置
    QuorumPeerConfig config = new QuorumPeerConfig();
	if (args.length == 1) {
		config.parse(args[0]); // 标记①，解析参数zoo.cfg 和 myid
	}

	// 标记②，启动定时任务，对过期的快照，执行删除（默认该功能关闭）
	DatadirCleanupManager purgeMgr = new DatadirCleanupManager(
		config.getDataDir(),
		config.getDataLogDir(),
		config.getSnapRetainCount(),
		config.getPurgeInterval());
	purgeMgr.start(); 

	if (args.length == 1 && config.isDistributed()) {
		runFromConfig(config); // 标记③，集群的启动方式
	} else {
		LOG.warn("Either no config or no quorum defined in config, running in standalone mode");
		// there is only server in the quorum -- run as standalone
		ZooKeeperServerMain.main(args);
	}
}
```

#### 1.2 解析参数

标记①，解析参数，跟进`config.parse(args[0]);`方法：

```java
public void parse(String path) throws ConfigException {
	LOG.info("Reading configuration from: " + path);

	try {
		File configFile = (new VerifyingFileFactory.Builder(LOG)
			.warnForRelativePath()
			.failForNonExistingPath()
			.build()).create(path);

		Properties cfg = new Properties();
		FileInputStream in = new FileInputStream(configFile); //配置文件
		try {
			cfg.load(in);
			configFileStr = path;
		} finally {
			in.close();
		}
		initialConfig = new String(Files.readAllBytes(configFile.toPath()));
		parseProperties(cfg); // 解析配置文件
	} catch (IOException e) {
		throw new ConfigException("Error processing " + path, e);
	} catch (IllegalArgumentException e) {
		throw new ConfigException("Error processing " + path, e);
	}
	// 省略

}
```

跟进`parseProperties(cfg); `方法：

```java
public void parseProperties(Properties zkProp) throws IOException, ConfigException {
	int clientPort = 0;
	int secureClientPort = 0;
	int observerMasterPort = 0;
	String clientPortAddress = null;
	String secureClientPortAddress = null;
	VerifyingFileFactory vff = new VerifyingFileFactory.Builder(LOG).warnForRelativePath().build();
	for (Entry<Object, Object> entry : zkProp.entrySet()) {
		String key = entry.getKey().toString().trim();
		String value = entry.getValue().toString().trim();
		if (key.equals("dataDir")) {
			dataDir = vff.create(value);
		} else if (key.equals("dataLogDir")) {
			dataLogDir = vff.create(value);
		} else if (key.equals("clientPort")) {
			clientPort = Integer.parseInt(value);
		} else if (key.equals("localSessionsEnabled")) {
			localSessionsEnabled = parseBoolean(key, value);
		} else if (key.equals("localSessionsUpgradingEnabled")) {
			localSessionsUpgradingEnabled = parseBoolean(key, value);
		} else if (key.equals("clientPortAddress")) {
			clientPortAddress = value.trim();
		} else if (key.equals("secureClientPort")) {
			secureClientPort = Integer.parseInt(value);
		} else if (key.equals("secureClientPortAddress")) {
			secureClientPortAddress = value.trim();
		} else if (key.equals("observerMasterPort")) {
			observerMasterPort = Integer.parseInt(value);
		} else if (key.equals("clientPortListenBacklog")) {
			clientPortListenBacklog = Integer.parseInt(value);
		} else if (key.equals("tickTime")) {
			tickTime = Integer.parseInt(value);
		} else if (key.equals("maxClientCnxns")) {
			maxClientCnxns = Integer.parseInt(value);
		} else if (key.equals("minSessionTimeout")) {
			minSessionTimeout = Integer.parseInt(value);
		} else if (key.equals("maxSessionTimeout")) {
			maxSessionTimeout = Integer.parseInt(value);
		} else if (key.equals("initLimit")) {
			initLimit = Integer.parseInt(value);
		} else if (key.equals("syncLimit")) {
			syncLimit = Integer.parseInt(value);
		} else if (key.equals("connectToLearnerMasterLimit")) {
			connectToLearnerMasterLimit = Integer.parseInt(value);
		} else if (key.equals("electionAlg")) {
			electionAlg = Integer.parseInt(value);
			if (electionAlg != 3) {
				throw new ConfigException("Invalid electionAlg value. Only 3 is supported.");
			}
		} else if (key.equals("quorumListenOnAllIPs")) {
			quorumListenOnAllIPs = parseBoolean(key, value);
		} else if (key.equals("peerType")) {
			if (value.toLowerCase().equals("observer")) {
				peerType = LearnerType.OBSERVER;
			} else if (value.toLowerCase().equals("participant")) {
				peerType = LearnerType.PARTICIPANT;
			} else {
				throw new ConfigException("Unrecognised peertype: " + value);
			}
		} else if (key.equals("syncEnabled")) {
			syncEnabled = parseBoolean(key, value);
		} else if (key.equals("dynamicConfigFile")) {
			dynamicConfigFileStr = value;
		} else if (key.equals("autopurge.snapRetainCount")) {
			snapRetainCount = Integer.parseInt(value);
		} else if (key.equals("autopurge.purgeInterval")) {
			purgeInterval = Integer.parseInt(value);
		} else if (key.equals("standaloneEnabled")) {
			setStandaloneEnabled(parseBoolean(key, value));
		} else if (key.equals("reconfigEnabled")) {
			setReconfigEnabled(parseBoolean(key, value));
		} else if (key.equals("sslQuorum")) {
			sslQuorum = parseBoolean(key, value);
		} else if (key.equals("portUnification")) {
			shouldUsePortUnification = parseBoolean(key, value);
		} else if (key.equals("sslQuorumReloadCertFiles")) {
			sslQuorumReloadCertFiles = parseBoolean(key, value);
		} else if ((key.startsWith("server.") || key.startsWith("group") || key.startsWith("weight"))
				   && zkProp.containsKey("dynamicConfigFile")) {
			throw new ConfigException("parameter: " + key + " must be in a separate dynamic config file");
		} else if (key.equals(QuorumAuth.QUORUM_SASL_AUTH_ENABLED)) {
			quorumEnableSasl = parseBoolean(key, value);
		} else if (key.equals(QuorumAuth.QUORUM_SERVER_SASL_AUTH_REQUIRED)) {
			quorumServerRequireSasl = parseBoolean(key, value);
		} else if (key.equals(QuorumAuth.QUORUM_LEARNER_SASL_AUTH_REQUIRED)) {
			quorumLearnerRequireSasl = parseBoolean(key, value);
		} else if (key.equals(QuorumAuth.QUORUM_LEARNER_SASL_LOGIN_CONTEXT)) {
			quorumLearnerLoginContext = value;
		} else if (key.equals(QuorumAuth.QUORUM_SERVER_SASL_LOGIN_CONTEXT)) {
			quorumServerLoginContext = value;
		} else if (key.equals(QuorumAuth.QUORUM_KERBEROS_SERVICE_PRINCIPAL)) {
			quorumServicePrincipal = value;
		} else if (key.equals("quorum.cnxn.threads.size")) {
			quorumCnxnThreadsSize = Integer.parseInt(value);
		} else if (key.equals(JvmPauseMonitor.INFO_THRESHOLD_KEY)) {
			jvmPauseInfoThresholdMs = Long.parseLong(value);
		} else if (key.equals(JvmPauseMonitor.WARN_THRESHOLD_KEY)) {
			jvmPauseWarnThresholdMs = Long.parseLong(value);
		} else if (key.equals(JvmPauseMonitor.SLEEP_TIME_MS_KEY)) {
			jvmPauseSleepTimeMs = Long.parseLong(value);
		} else if (key.equals(JvmPauseMonitor.JVM_PAUSE_MONITOR_FEATURE_SWITCH_KEY)) {
			jvmPauseMonitorToRun = parseBoolean(key, value);
		} else if (key.equals("metricsProvider.className")) {
			metricsProviderClassName = value;
		} else if (key.startsWith("metricsProvider.")) {
			String keyForMetricsProvider = key.substring(16);
			metricsProviderConfiguration.put(keyForMetricsProvider, value);
		} else if (key.equals("multiAddress.enabled")) {
			multiAddressEnabled = parseBoolean(key, value);
		} else if (key.equals("multiAddress.reachabilityCheckTimeoutMs")) {
			multiAddressReachabilityCheckTimeoutMs = Integer.parseInt(value);
		} else if (key.equals("multiAddress.reachabilityCheckEnabled")) {
			multiAddressReachabilityCheckEnabled = parseBoolean(key, value);
		} else {
			System.setProperty("zookeeper." + key, value);
		}
	}

	if (!quorumEnableSasl && quorumServerRequireSasl) {
		throw new IllegalArgumentException(QuorumAuth.QUORUM_SASL_AUTH_ENABLED
										   + " is disabled, so cannot enable "
										   + QuorumAuth.QUORUM_SERVER_SASL_AUTH_REQUIRED);
	}
	if (!quorumEnableSasl && quorumLearnerRequireSasl) {
		throw new IllegalArgumentException(QuorumAuth.QUORUM_SASL_AUTH_ENABLED
										   + " is disabled, so cannot enable "
										   + QuorumAuth.QUORUM_LEARNER_SASL_AUTH_REQUIRED);
	}
	// If quorumpeer learner is not auth enabled then self won't be able to
	// join quorum. So this condition is ensuring that the quorumpeer learner
	// is also auth enabled while enabling quorum server require sasl.
	if (!quorumLearnerRequireSasl && quorumServerRequireSasl) {
		throw new IllegalArgumentException(QuorumAuth.QUORUM_LEARNER_SASL_AUTH_REQUIRED
										   + " is disabled, so cannot enable "
										   + QuorumAuth.QUORUM_SERVER_SASL_AUTH_REQUIRED);
	}

	// Reset to MIN_SNAP_RETAIN_COUNT if invalid (less than 3)
	// PurgeTxnLog.purge(File, File, int) will not allow to purge less
	// than 3.
	if (snapRetainCount < MIN_SNAP_RETAIN_COUNT) {
		LOG.warn("Invalid autopurge.snapRetainCount: "
				 + snapRetainCount
				 + ". Defaulting to "
				 + MIN_SNAP_RETAIN_COUNT);
		snapRetainCount = MIN_SNAP_RETAIN_COUNT;
	}

	if (dataDir == null) {
		throw new IllegalArgumentException("dataDir is not set");
	}
	if (dataLogDir == null) {
		dataLogDir = dataDir;
	}

	if (clientPort == 0) {
		LOG.info("clientPort is not set");
		if (clientPortAddress != null) {
			throw new IllegalArgumentException("clientPortAddress is set but clientPort is not set");
		}
	} else if (clientPortAddress != null) {
		this.clientPortAddress = new InetSocketAddress(InetAddress.getByName(clientPortAddress), clientPort);
		LOG.info("clientPortAddress is {}", formatInetAddr(this.clientPortAddress));
	} else {
		this.clientPortAddress = new InetSocketAddress(clientPort);
		LOG.info("clientPortAddress is {}", formatInetAddr(this.clientPortAddress));
	}

	if (secureClientPort == 0) {
		LOG.info("secureClientPort is not set");
		if (secureClientPortAddress != null) {
			throw new IllegalArgumentException("secureClientPortAddress is set but secureClientPort is not set");
		}
	} else if (secureClientPortAddress != null) {
		this.secureClientPortAddress = new InetSocketAddress(InetAddress.getByName(secureClientPortAddress), secureClientPort);
		LOG.info("secureClientPortAddress is {}", formatInetAddr(this.secureClientPortAddress));
	} else {
		this.secureClientPortAddress = new InetSocketAddress(secureClientPort);
		LOG.info("secureClientPortAddress is {}", formatInetAddr(this.secureClientPortAddress));
	}
	if (this.secureClientPortAddress != null) {
		configureSSLAuth();
	}

	if (observerMasterPort <= 0) {
		LOG.info("observerMasterPort is not set");
	} else {
		this.observerMasterPort = observerMasterPort;
		LOG.info("observerMasterPort is {}", observerMasterPort);
	}

	if (tickTime == 0) {
		throw new IllegalArgumentException("tickTime is not set");
	}

	minSessionTimeout = minSessionTimeout == -1 ? tickTime * 2 : minSessionTimeout;
	maxSessionTimeout = maxSessionTimeout == -1 ? tickTime * 20 : maxSessionTimeout;

	if (minSessionTimeout > maxSessionTimeout) {
		throw new IllegalArgumentException("minSessionTimeout must not be larger than maxSessionTimeout");
	}

	LOG.info("metricsProvider.className is {}", metricsProviderClassName);
	try {
		Class.forName(metricsProviderClassName, false, Thread.currentThread().getContextClassLoader());
	} catch (ClassNotFoundException error) {
		throw new IllegalArgumentException("metrics provider class was not found", error);
	}

	// backward compatibility - dynamic configuration in the same file as
	// static configuration params see writeDynamicConfig()
	if (dynamicConfigFileStr == null) { // 解析myid
		setupQuorumPeerConfig(zkProp, true);// 解析myid
		if (isDistributed() && isReconfigEnabled()) {
			// we don't backup static config for standalone mode.
			// we also don't backup if reconfig feature is disabled.
			backupOldConfig();
		}
	}
}
```

跟进`setupQuorumPeerConfig(zkProp, true);`方法：

```java
void setupQuorumPeerConfig(Properties prop, boolean configBackwardCompatibilityMode) throws IOException, ConfigException {
	quorumVerifier = parseDynamicConfig(prop, electionAlg, true, configBackwardCompatibilityMode);
	setupMyId(); // 继续跟进
	setupClientPort();
	setupPeerType();
	checkValidity();
}
```

继续跟进`setupMyId(); `:

```java
private void setupMyId() throws IOException {
	File myIdFile = new File(dataDir, "myid"); // myid文件放在dataDir中
	if (!myIdFile.isFile()) {
		return;
	}
	BufferedReader br = new BufferedReader(new FileReader(myIdFile));
	String myIdString;
	try {
		myIdString = br.readLine(); // 读取一行
	} finally {
		br.close();
	}
	try {
		serverId = Long.parseLong(myIdString); // 赋值给了serverId
		MDC.put("myid", myIdString);
	} catch (NumberFormatException e) {
		throw new IllegalArgumentException("serverid " + myIdString + " is not a number");
	}
}
```

#### 1.3 过期快照删除

标记②，启动定时任务，对过期的快照，执行删除（默认该功能关闭）DatadirCleanupManager用了start方法：

```java
public void start() {
	if (PurgeTaskStatus.STARTED == purgeTaskStatus) {
		LOG.warn("Purge task is already running.");
		return;
	}
	// 默认情况 purgeInterval=0，该任务关闭，直接返回
	if (purgeInterval <= 0) {
		LOG.info("Purge task is not scheduled.");
		return;
	}
	
    // 创建了一个定时器Timer
	timer = new Timer("PurgeTask", true);
    // 创建一个清理快照任务 dataLogDir：日志目录 snapDir：快照目录 snapRetainCount：快照文件个数
	TimerTask task = new PurgeTask(dataLogDir, snapDir, snapRetainCount);
    // 提交任务： purgeInterval设置的值是 1，表示1小时检查一次，判断是否有过期快照，有则删除
	timer.scheduleAtFixedRate(task, 0, TimeUnit.HOURS.toMillis(purgeInterval));
	purgeTaskStatus = PurgeTaskStatus.STARTED;
}
```

跟进任务的run方法：

```java
public void run() {
	LOG.info("Purge task started.");
	try {
        // 继续跟进  dataLogDir：日志目录 snapDir：快照目录 snapRetainCount：快照文件个数
		PurgeTxnLog.purge(logsDir, snapsDir, snapRetainCount);
	} catch (Exception e) {
		LOG.error("Error occurred while purging.", e);
	}
	LOG.info("Purge task completed.");
}
```

继续跟进`PurgeTxnLog.purge(logsDir, snapsDir, snapRetainCount);`

```java
public static void purge(File dataDir, File snapDir, int num) throws IOException {
	if (num < 3) { // 快照文件个数不能小于3
		throw new IllegalArgumentException(COUNT_ERR_MSG);
	}
	FileTxnSnapLog txnLog = new FileTxnSnapLog(dataDir, snapDir); // 获取快照文件
	List<File> snaps = txnLog.findNValidSnapshots(num);
	int numSnaps = snaps.size();
	if (numSnaps > 0) {
		purgeOlderSnapshots(txnLog, snaps.get(numSnaps - 1)); // 删除文件
	}
}
```

标记③，集群的启动方式，跟进`runFromConfig(config); `方法：

```java
public void runFromConfig(QuorumPeerConfig config) throws IOException, AdminServerException {
	try {
		ManagedUtil.registerLog4jMBeans();
	} catch (JMException e) {
		LOG.warn("Unable to register log4j JMX control", e);
	}

	LOG.info("Starting quorum peer, myid=" + config.getServerId());
	final MetricsProvider metricsProvider;
	try {
		metricsProvider = MetricsProviderBootstrap.startMetricsProvider(
			config.getMetricsProviderClassName(),
			config.getMetricsProviderConfiguration());
	} catch (MetricsProviderLifeCycleException error) {
		throw new IOException("Cannot boot MetricsProvider " + config.getMetricsProviderClassName(), error);
	}
	try {
		ServerMetrics.metricsProviderInitialized(metricsProvider);
		ProviderRegistry.initialize();
		ServerCnxnFactory cnxnFactory = null;
		ServerCnxnFactory secureCnxnFactory = null;
		// 标记①，通信组件初始化，默认是 NIO 通信
		if (config.getClientPortAddress() != null) {
			cnxnFactory = ServerCnxnFactory.createFactory();
			cnxnFactory.configure(config.getClientPortAddress(), config.getMaxClientCnxns(), config.getClientPortListenBacklog(), false);
		}

		if (config.getSecureClientPortAddress() != null) {
			secureCnxnFactory = ServerCnxnFactory.createFactory();
			secureCnxnFactory.configure(config.getSecureClientPortAddress(), config.getMaxClientCnxns(), config.getClientPortListenBacklog(), true);
		}

        //  把解析的参数赋值给该 zookeeper 节点
		quorumPeer = getQuorumPeer();
		quorumPeer.setTxnFactory(new FileTxnSnapLog(config.getDataLogDir(), config.getDataDir()));
		quorumPeer.enableLocalSessions(config.areLocalSessionsEnabled());
		quorumPeer.enableLocalSessionsUpgrading(config.isLocalSessionsUpgradingEnabled());
		//quorumPeer.setQuorumPeers(config.getAllMembers());
		quorumPeer.setElectionType(config.getElectionAlg()); // 选举算法，默认是3
		quorumPeer.setMyid(config.getServerId());
		quorumPeer.setTickTime(config.getTickTime());
		quorumPeer.setMinSessionTimeout(config.getMinSessionTimeout());
		quorumPeer.setMaxSessionTimeout(config.getMaxSessionTimeout());
		quorumPeer.setInitLimit(config.getInitLimit());
		quorumPeer.setSyncLimit(config.getSyncLimit());
		quorumPeer.setConnectToLearnerMasterLimit(config.getConnectToLearnerMasterLimit());
		quorumPeer.setObserverMasterPort(config.getObserverMasterPort());
		quorumPeer.setConfigFileName(config.getConfigFilename());
		quorumPeer.setClientPortListenBacklog(config.getClientPortListenBacklog());
		quorumPeer.setZKDatabase(new ZKDatabase(quorumPeer.getTxnFactory()));
		quorumPeer.setQuorumVerifier(config.getQuorumVerifier(), false);
		if (config.getLastSeenQuorumVerifier() != null) {
			quorumPeer.setLastSeenQuorumVerifier(config.getLastSeenQuorumVerifier(), false);
		}
		quorumPeer.initConfigInZKDatabase();
		quorumPeer.setCnxnFactory(cnxnFactory);
		quorumPeer.setSecureCnxnFactory(secureCnxnFactory);
		quorumPeer.setSslQuorum(config.isSslQuorum());
		quorumPeer.setUsePortUnification(config.shouldUsePortUnification());
		quorumPeer.setLearnerType(config.getPeerType());
		quorumPeer.setSyncEnabled(config.getSyncEnabled());
		quorumPeer.setQuorumListenOnAllIPs(config.getQuorumListenOnAllIPs());
		if (config.sslQuorumReloadCertFiles) {
			quorumPeer.getX509Util().enableCertFileReloading();
		}
		quorumPeer.setMultiAddressEnabled(config.isMultiAddressEnabled());
		quorumPeer.setMultiAddressReachabilityCheckEnabled(config.isMultiAddressReachabilityCheckEnabled());
		quorumPeer.setMultiAddressReachabilityCheckTimeoutMs(config.getMultiAddressReachabilityCheckTimeoutMs());

		// sets quorum sasl authentication configurations
		quorumPeer.setQuorumSaslEnabled(config.quorumEnableSasl);
		if (quorumPeer.isQuorumSaslAuthEnabled()) {
			quorumPeer.setQuorumServerSaslRequired(config.quorumServerRequireSasl);
			quorumPeer.setQuorumLearnerSaslRequired(config.quorumLearnerRequireSasl);
			quorumPeer.setQuorumServicePrincipal(config.quorumServicePrincipal);
			quorumPeer.setQuorumServerLoginContext(config.quorumServerLoginContext);
			quorumPeer.setQuorumLearnerLoginContext(config.quorumLearnerLoginContext);
		}
		quorumPeer.setQuorumCnxnThreadsSize(config.quorumCnxnThreadsSize);
		quorumPeer.initialize();

		if (config.jvmPauseMonitorToRun) {
			quorumPeer.setJvmPauseMonitor(new JvmPauseMonitor(config));
		}

		quorumPeer.start(); // 
		ZKAuditProvider.addZKStartStopAuditLog();
		quorumPeer.join();
	} catch (InterruptedException e) {
		// warn, but generally this is ok
		LOG.warn("Quorum Peer interrupted", e);
	} finally {
		try {
			metricsProvider.stop();
		} catch (Throwable error) {
			LOG.warn("Error while stopping metrics", error);
		}
	}
}
```

#### 1.4 初始化通信组件

 标记①，通信组件初始化，默认是 NIO 通信，跟进`cnxnFactory = ServerCnxnFactory.createFactory();`方法：

```java
public static ServerCnxnFactory createFactory() throws IOException {
    //ZOOKEEPER_SERVER_CNXN_FACTORY = zookeeper.serverCnxnFactory
    // 在zookeeperAdmin.md 文件中 NIOServerCnxnFactory
	String serverCnxnFactoryName = System.getProperty(ZOOKEEPER_SERVER_CNXN_FACTORY);
	if (serverCnxnFactoryName == null) {
		serverCnxnFactoryName = NIOServerCnxnFactory.class.getName();
	}
	try {
        // 利用反射创建
		ServerCnxnFactory serverCnxnFactory = (ServerCnxnFactory) Class.forName(serverCnxnFactoryName)
																	   .getDeclaredConstructor()
																	   .newInstance();
		LOG.info("Using {} as server connection factory", serverCnxnFactoryName);
		return serverCnxnFactory;
	} catch (Exception e) {
		IOException ioe = new IOException("Couldn't instantiate " + serverCnxnFactoryName, e);
		throw ioe;
	}
}
```

创建后，又做了什么？跟进`cnxnFactory.configure(config.getClientPortAddress(), config.getMaxClientCnxns(), config.getClientPortListenBacklog(), false);`方法:

```java
public void configure(InetSocketAddress addr, int maxcc, int backlog, boolean secure) throws IOException {
	if (secure) {
		throw new UnsupportedOperationException("SSL isn't supported in NIOServerCnxn");
	}
	configureSaslLogin();

	maxClientCnxns = maxcc;
	initMaxCnxns();
	sessionlessCnxnTimeout = Integer.getInteger(ZOOKEEPER_NIO_SESSIONLESS_CNXN_TIMEOUT, 10000);
	// We also use the sessionlessCnxnTimeout as expiring interval for
	// cnxnExpiryQueue. These don't need to be the same, but the expiring
	// interval passed into the ExpiryQueue() constructor below should be
	// less than or equal to the timeout.
	cnxnExpiryQueue = new ExpiryQueue<NIOServerCnxn>(sessionlessCnxnTimeout);
	expirerThread = new ConnectionExpirerThread();

	int numCores = Runtime.getRuntime().availableProcessors();
	// 32 cores sweet spot seems to be 4 selector threads
	numSelectorThreads = Integer.getInteger(
		ZOOKEEPER_NIO_NUM_SELECTOR_THREADS,
		Math.max((int) Math.sqrt((float) numCores / 2), 1));
	if (numSelectorThreads < 1) {
		throw new IOException("numSelectorThreads must be at least 1");
	}

	numWorkerThreads = Integer.getInteger(ZOOKEEPER_NIO_NUM_WORKER_THREADS, 2 * numCores);
	workerShutdownTimeoutMS = Long.getLong(ZOOKEEPER_NIO_SHUTDOWN_TIMEOUT, 5000);

	String logMsg = "Configuring NIO connection handler with "
		+ (sessionlessCnxnTimeout / 1000) + "s sessionless connection timeout, "
		+ numSelectorThreads + " selector thread(s), "
		+ (numWorkerThreads > 0 ? numWorkerThreads : "no") + " worker threads, and "
		+ (directBufferBytes == 0 ? "gathered writes." : ("" + (directBufferBytes / 1024) + " kB direct buffers."));
	LOG.info(logMsg);
	for (int i = 0; i < numSelectorThreads; ++i) {
		selectorThreads.add(new SelectorThread(i));
	}

	listenBacklog = backlog;
     // 初始化 NIO 服务端 socket，绑定 2181 端口，可以接收客户端请求
	this.ss = ServerSocketChannel.open();
	ss.socket().setReuseAddress(true);
	LOG.info("binding to port {}", addr);
	if (listenBacklog == -1) {
		ss.socket().bind(addr);
	} else {
		ss.socket().bind(addr, listenBacklog);
	}
	ss.configureBlocking(false);
	acceptThread = new AcceptThread(ss, addr, selectorThreads);
}
```

#### 1.5 选举

初始化通信组件后，继续跟进`quorumPeer.start();`方法：

```java
public synchronized void start() {
	if (!getView().containsKey(myid)) {
		throw new RuntimeException("My id " + myid + " not in the peer list");
	}
	loadDataBase(); // 冷启动恢复数据，根据快照文件和日志文件恢复数据
	startServerCnxnFactory(); // 启动通信组件
	try {
		adminServer.start(); 
	} catch (AdminServerException e) {
		LOG.warn("Problem starting AdminServer", e);
		System.out.println(e);
	} 
	startLeaderElection(); // 选举之前准备阶段
	startJvmPauseMonitor(); 
	super.start(); // 开始选举
}
```

##### 1.5.1 选举之前

跟进`startLeaderElection();`方法：

```java
public synchronized void startLeaderElection() {
	try {
		if (getPeerState() == ServerState.LOOKING) {
            // 创建选票 ，开始选票时，都是先投自己，myid= serverid= 自己
			currentVote = new Vote(myid, getLastLoggedZxid(), getCurrentEpoch());
		}
	} catch (IOException e) {
		RuntimeException re = new RuntimeException(e.getMessage());
		re.setStackTrace(e.getStackTrace());
		throw re;
	}
	// 创建选举算法实例
	this.electionAlg = createElectionAlgorithm(electionType);
}
```

创建选举算法实例，跟进`this.electionAlg = createElectionAlgorithm(electionType);`方法：

```java
protected Election createElectionAlgorithm(int electionAlgorithm) {
	Election le = null;

	//TODO: use a factory rather than a switch
	switch (electionAlgorithm) {
	case 1:
		throw new UnsupportedOperationException("Election Algorithm 1 is not supported.");
	case 2:
		throw new UnsupportedOperationException("Election Algorithm 2 is not supported.");
	case 3:
        // 标记①，创建 QuorumCnxnManager，负责选举过程中的所有网络通信
		QuorumCnxManager qcm = createCnxnManager();
		QuorumCnxManager oldQcm = qcmRef.getAndSet(qcm);
		if (oldQcm != null) {
			LOG.warn("Clobbering already-set QuorumCnxManager (restarting leader election?)");
			oldQcm.halt();
		}
        // 
		QuorumCnxManager.Listener listener = qcm.listener;
		if (listener != null) {
			listener.start(); // 标记②，启动监听线程
			FastLeaderElection fle = new FastLeaderElection(this, qcm);
			fle.start(); // 标记③，准备开始选举
			le = fle;
		} else {
			LOG.error("Null listener when initializing cnx manager");
		}
		break;
	default:
		assert false;
	}
	return le;
}
```

标记①，创建 QuorumCnxnManager，负责选举过程中的所有网络通信

```java
public QuorumCnxManager createCnxnManager() {
	int timeout = quorumCnxnTimeoutMs > 0 ? quorumCnxnTimeoutMs : this.tickTime * this.syncLimit;
	LOG.info("Using {}ms as the quorum cnxn socket timeout", timeout);
	return new QuorumCnxManager(
		this,
		this.getId(),
		this.getView(),
		this.authServer,
		this.authLearner,
		timeout,
		this.getQuorumListenOnAllIPs(),
		this.quorumCnxnThreadsSize,
		this.isQuorumSaslAuthEnabled());
}

```

跟进`QuorumCnxManager`的构造方法:

```java
public QuorumCnxManager(QuorumPeer self, final long mySid, Map<Long, QuorumPeer.QuorumServer> view,
	QuorumAuthServer authServer, QuorumAuthLearner authLearner, int socketTimeout, boolean listenOnAllIPs,
	int quorumCnxnThreadsSize, boolean quorumSaslAuthEnabled) {

	this.recvQueue = new CircularBlockingQueue<>(RECV_CAPACITY);
	this.queueSendMap = new ConcurrentHashMap<>();
	this.senderWorkerMap = new ConcurrentHashMap<>();
	this.lastMessageSent = new ConcurrentHashMap<>();

	String cnxToValue = System.getProperty("zookeeper.cnxTimeout");
	if (cnxToValue != null) {
		this.cnxTO = Integer.parseInt(cnxToValue);
	}

	this.self = self;

	this.mySid = mySid;
	this.socketTimeout = socketTimeout;
	this.view = view;
	this.listenOnAllIPs = listenOnAllIPs;
	this.authServer = authServer;
	this.authLearner = authLearner;
	this.quorumSaslAuthEnabled = quorumSaslAuthEnabled;

	initializeConnectionExecutor(mySid, quorumCnxnThreadsSize);

	// Starts listener thread that waits for connection requests
	listener = new Listener();
	listener.setName("QuorumPeerListener");
}
```

标记②，启动监听线程，跟进`listener.start();`方法：QuorumCnxManager.Listener是一个线程，调用start方法，执行的run方法：

```java
ublic void run() {
		if (!shutdown) {
			LOG.debug("Listener thread started, myId: {}", self.getId());
			Set<InetSocketAddress> addresses;

			if (self.getQuorumListenOnAllIPs()) { // 获取所有集群通信地址
				addresses = self.getElectionAddress().getWildcardAddresses();
			} else {
				addresses = self.getElectionAddress().getAllAddresses();
			}

			CountDownLatch latch = new CountDownLatch(addresses.size());
            // 创建listenerHandlers是List<ListenerHandler>，ListenerHandler是实现Runnable, Closeable接口的
			listenerHandlers = addresses.stream().map(address ->
							new ListenerHandler(address, self.shouldUsePortUnification(), self.isSslQuorum(), latch))
					.collect(Collectors.toList());
			// 创建线程池
			ExecutorService executor = Executors.newFixedThreadPool(addresses.size());
			listenerHandlers.forEach(executor::submit); // 提交任务

			try {
				latch.await();
			} catch (InterruptedException ie) {
				LOG.error("Interrupted while sleeping. Ignoring exception", ie);
			} finally {
				// Clean up for shutdown.
				for (ListenerHandler handler : listenerHandlers) {
					try {
						handler.close();
					} catch (IOException ie) {
						// Don't log an error for shutdown.
						LOG.debug("Error closing server socket", ie);
					}
				}
			}
		}

		LOG.info("Leaving listener");
		if (!shutdown) {
			LOG.error(
			  "As I'm leaving the listener thread, I won't be able to participate in leader election any longer: {}",
			  self.getElectionAddress().getAllAddresses().stream()
				.map(NetUtils::formatInetAddr)
				.collect(Collectors.joining("|")));
			if (socketException.get()) {
				// After leaving listener thread, the host cannot join the quorum anymore,
				// this is a severe error that we cannot recover from, so we need to exit
				socketBindErrorHandler.run();
			}
		}
	}
```

由上代码分析可知：创建线程池， 提交任务最终执行的是ListenerHandler的run方法：

```java
public void run() {
	try {
		Thread.currentThread().setName("ListenerHandler-" + address);
		acceptConnections();
		try {
			close();
		} catch (IOException e) {
			LOG.warn("Exception when shutting down listener: ", e);
		}
	} catch (Exception e) {
		// Output of unexpected exception, should never happen
		LOG.error("Unexpected error ", e);
	} finally {
		latch.countDown();
	}
}
```

继续跟进`acceptConnections();`方法：

```java
private void acceptConnections() {
	int numRetries = 0;
	Socket client = null;

	while ((!shutdown) && (portBindMaxRetry == 0 || numRetries < portBindMaxRetry)) {
		try {
			serverSocket = createNewServerSocket();// 创建ServerSocket
			LOG.info("{} is accepting connections now, my election bind port: {}", QuorumCnxManager.this.mySid, address.toString());
			while (!shutdown) { 
				try {
                    {
					// 阻塞，等待处理请求
					client = serverSocket.accept(); 
					setSockOpts(client);
					LOG.info("Received connection request from {}", client.getRemoteSocketAddress());
					// Receive and handle the connection request
					// asynchronously if the quorum sasl authentication is
					// enabled. This is required because sasl server
					// authentication process may take few seconds to finish,
					// this may delay next peer connection requests.
					if (quorumSaslAuthEnabled) {
						receiveConnectionAsync(client);
					} else {
						receiveConnection(client); // 处理请求
					}
					numRetries = 0;
				} catch (SocketTimeoutException e) {
					LOG.warn("The socket is listening for the election accepted "
							+ "and it timed out unexpectedly, but will retry."
							+ "see ZOOKEEPER-2836");
				}
			}
		} catch (IOException e) {
			if (shutdown) {
				break;
			}

			LOG.error("Exception while listening", e);

			if (e instanceof SocketException) {
				socketException.set(true);
			}

			numRetries++;
			try {
				close();
				Thread.sleep(1000);
			} catch (IOException ie) {
				LOG.error("Error closing server socket", ie);
			} catch (InterruptedException ie) {
				LOG.error("Interrupted while sleeping. Ignoring exception", ie);
			}
			closeSocket(client);
		}
	}
	if (!shutdown) {
		LOG.error(
		  "Leaving listener thread for address {} after {} errors. Use {} property to increase retry count.",
		  formatInetAddr(address),
		  numRetries,
		  ELECTION_PORT_BIND_RETRY);
	}
}
```

跟进`receiveConnection(client);`方法：

```java
public void receiveConnection(final Socket sock) {
	DataInputStream din = null;
	try {
        // 获取Socket接收的数据
		din = new DataInputStream(new BufferedInputStream(sock.getInputStream()));

		LOG.debug("Sync handling of connection request received from: {}", sock.getRemoteSocketAddress());
		handleConnection(sock, din); // 解析数据
	} catch (IOException e) {
		LOG.error("Exception handling connection, addr: {}, closing server connection", sock.getRemoteSocketAddress());
		LOG.debug("Exception details: ", e);
		closeSocket(sock);
	}
}
```

跟进`handleConnection(sock, din);`方法：

```java
private void handleConnection(Socket sock, DataInputStream din) throws IOException {
	Long sid = null, protocolVersion = null;
	MultipleAddresses electionAddr = null;

	try {
         // 获取服务器id，就是那个服务器myid
		protocolVersion = din.readLong();
		if (protocolVersion >= 0) {
			sid = protocolVersion;
		} else {
			try {
				InitialMessage init = InitialMessage.parse(protocolVersion, din);
				sid = init.sid;
				if (!init.electionAddr.isEmpty()) {
					electionAddr = new MultipleAddresses(init.electionAddr,
							Duration.ofMillis(self.getMultiAddressReachabilityCheckTimeoutMs()));
				}
				LOG.debug("Initial message parsed by {}: {}", self.getId(), init.toString());
			} catch (InitialMessage.InitialMessageException ex) {
				LOG.error("Initial message parsing error!", ex);
				closeSocket(sock);
				return;
			}
		}

		if (sid == QuorumPeer.OBSERVER_ID) {
			/*
			 * Choose identifier at random. We need a value to identify
			 * the connection.
			 */
			sid = observerCounter.getAndDecrement();
			LOG.info("Setting arbitrary identifier to observer: {}", sid);
		}
	} catch (IOException e) {
		LOG.warn("Exception reading or writing challenge", e);
		closeSocket(sock);
		return;
	}

	authServer.authenticate(sock, din);
	if (sid < self.getId()) { // 服务器myId比自己myId小的，关闭myId小建立的连接，自己建立连接
		SendWorker sw = senderWorkerMap.get(sid);
		if (sw != null) {
			sw.finish();
		}
		LOG.debug("Create new connection to server: {}", sid);
		closeSocket(sock);
		if (electionAddr != null) {
			connectOne(sid, electionAddr);
		} else {
			connectOne(sid);
		}
	} else if (sid == self.getId()) { // 自己对自己发消息
		// we saw this case in ZOOKEEPER-2164
		LOG.warn("We got a connection request from a server with our own ID. "
				 + "This should be either a configuration error, or a bug.");
	} else { // 服务器myId比自己myId大.
		SendWorker sw = new SendWorker(sock, sid);
		RecvWorker rw = new RecvWorker(sock, din, sid, sw);
		sw.setRecv(rw);

		SendWorker vsw = senderWorkerMap.get(sid);

		if (vsw != null) {
			vsw.finish();
		}

		senderWorkerMap.put(sid, sw);

		queueSendMap.putIfAbsent(sid, new CircularBlockingQueue<>(SEND_CAPACITY));

		sw.start();
		rw.start();
	}
}
```

SendWorker和RecvWorker都是线程，查看它们的run方法，SendWorker的run方法：

```java
public void run() {
	threadCnt.incrementAndGet();
	try {
		BlockingQueue<ByteBuffer> bq = queueSendMap.get(sid);
        // 如果队列中没有要发送的内容，那么我们发送lastMessage以确保最后一条消息
		if (bq == null || isSendQueueEmpty(bq)) {
			ByteBuffer b = lastMessageSent.get(sid);
			if (b != null) {
				LOG.debug("Attempting to send lastMessage to sid={}", sid);
				send(b);
			}
		}
	} catch (IOException e) {
		LOG.error("Failed to send last message. Shutting down thread.", e);
		this.finish();
	}
	LOG.debug("SendWorker thread started towards {}. myId: {}", sid, QuorumCnxManager.this.mySid);

	try {
		while (running && !shutdown && sock != null) { // 没有关闭

			ByteBuffer b = null;
			try {
				BlockingQueue<ByteBuffer> bq = queueSendMap.get(sid);
				if (bq != null) { // 取出队列消息
					b = pollSendQueue(bq, 1000, TimeUnit.MILLISECONDS);
				} else {
					LOG.error("No queue of incoming messages for server {}", sid);
					break;
				}

				if (b != null) { 
					lastMessageSent.put(sid, b);
					send(b);//发送消息
				}
			} catch (InterruptedException e) {
				LOG.warn("Interrupted while waiting for message on queue", e);
			}
		}
	} catch (Exception e) {
		LOG.warn(
			"Exception when using channel: for id {} my id = {}",
			sid ,
			QuorumCnxManager.this.mySid,
			e);
	}
	this.finish();

	LOG.warn("Send worker leaving thread id {} my id = {}", sid, self.getId());
}
```

RecvWorker的run方法：

```java
public void run() {
	threadCnt.incrementAndGet();
	try {
		LOG.debug("RecvWorker thread towards {} started. myId: {}", sid, QuorumCnxManager.this.mySid);
		while (running && !shutdown && sock != null) {
			
			int length = din.readInt(); // 读取信息
			if (length <= 0 || length > PACKETMAXSIZE) {
				throw new IOException("Received packet with invalid packet: " + length);
			}
			final byte[] msgArray = new byte[length];
			din.readFully(msgArray, 0, length);
			addToRecvQueue(new Message(ByteBuffer.wrap(msgArray), sid)); // 存入RecvQueue中
		}
	} catch (Exception e) {
		LOG.warn(
			"Connection broken for id {}, my id = {}",
			sid,
			QuorumCnxManager.this.mySid,
			e);
	} finally {
		LOG.warn("Interrupting SendWorker thread from RecvWorker. sid: {}. myId: {}", sid, QuorumCnxManager.this.mySid);
		sw.finish();
		closeSocket(sock);
	}
}

```

到此，我们先大致有个印象，然后继续回到，标记③，准备开始选举，先看FastLeaderElection的构造方法：

```java
public FastLeaderElection(QuorumPeer self, QuorumCnxManager manager) {
	this.stop = false;
	this.manager = manager;
	starter(self, manager); // 继续，如下
}
private void starter(QuorumPeer self, QuorumCnxManager manager) {
	this.self = self;
	proposedLeader = -1;
	proposedZxid = -1;

	sendqueue = new LinkedBlockingQueue<ToSend>(); // 初始化两个队列
	recvqueue = new LinkedBlockingQueue<Notification>();
	this.messenger = new Messenger(manager);//创建Messenger对象
}
Messenger(QuorumCnxManager manager) {// 创建Messenger对象构造
	this.ws = new WorkerSender(manager); // WorkerSender也是线程
	this.wsThread = new Thread(this.ws, "WorkerSender[myid=" + self.getId() + "]");
	this.wsThread.setDaemon(true);
	this.wr = new WorkerReceiver(manager);// WorkerReceiver也是线程
	this.wrThread = new Thread(this.wr, "WorkerReceiver[myid=" + self.getId() + "]");
	this.wrThread.setDaemon(true);
}
```

FastLeaderElection的start()方法：

```java
public void start() {
	this.messenger.start();
}
void start() {
	this.wsThread.start(); // WorkerSender线程start方法
	this.wrThread.start(); //  WorkerReceiver线程start方法
}
```

WorkerSender线程start方法，查看WorkerSender的run方法：

```java
public void run() {
	while (!stop) {
		try {
			ToSend m = sendqueue.poll(3000, TimeUnit.MILLISECONDS);
			if (m == null) {
				continue;
			}

			process(m);
		} catch (InterruptedException e) {
			break;
		}
	}
	LOG.info("WorkerSender is down");
}
void process(ToSend m) {
	ByteBuffer requestBuffer = buildMsg(m.state.ordinal(), m.leader, m.zxid, m.electionEpoch, m.peerEpoch, m.configData);
	manager.toSend(m.sid, requestBuffer);

}
```

继续跟进`manager.toSend(m.sid, requestBuffer);`方法：

```java
public void toSend(Long sid, ByteBuffer b) {
	if (this.mySid == sid) { // 给自己的发送消息
		b.position(0);
		addToRecvQueue(new Message(b.duplicate(), sid));
	} else {
		BlockingQueue<ByteBuffer> bq = queueSendMap.computeIfAbsent(sid, serverId -> new CircularBlockingQueue<>(SEND_CAPACITY)); // 添加到发送的SendMap中 
		addToSendQueue(bq, b);
		connectOne(sid);
	}
}
```

 WorkerReceiver线程start方法，查看WorkerReceiver的run方法：

```java
public void run() {
	Message response;
	while (!stop) {
		try {
            // 取出recvQueeeue
			response = manager.pollRecvQueue(3000, TimeUnit.MILLISECONDS);
			if (response == null) {
				continue;
			}
			final int capacity = response.buffer.capacity();
			if (capacity < 28) {
				LOG.error("Got a short response from server {}: {}", response.sid, capacity);
				continue;
			}
			boolean backCompatibility28 = (capacity == 28);
			boolean backCompatibility40 = (capacity == 40);
			response.buffer.clear();
			Notification n = new Notification();
			int rstate = response.buffer.getInt();
			long rleader = response.buffer.getLong();
			long rzxid = response.buffer.getLong();
			long relectionEpoch = response.buffer.getLong();
			long rpeerepoch;
			int version = 0x0;
			QuorumVerifier rqv = null;
			try {
				if (!backCompatibility28) {
					rpeerepoch = response.buffer.getLong();
					if (!backCompatibility40) {
						version = response.buffer.getInt();
					} else {
						LOG.info("Backward compatibility mode (36 bits), server id: {}", response.sid);
					}
				} else {
					LOG.info("Backward compatibility mode (28 bits), server id: {}", response.sid);
					rpeerepoch = ZxidUtils.getEpochFromZxid(rzxid);
				}

				if (version > 0x1) {
					int configLength = response.buffer.getInt();
					if (configLength < 0 || configLength > capacity) {
						throw new IOException(String.format("Invalid configLength in notification message! sid=%d, capacity=%d, version=%d, configLength=%d",
															response.sid, capacity, version, configLength));
					}

					byte[] b = new byte[configLength];
					response.buffer.get(b);

					synchronized (self) {
						try {
							rqv = self.configFromString(new String(b, UTF_8));
							QuorumVerifier curQV = self.getQuorumVerifier();
							if (rqv.getVersion() > curQV.getVersion()) {
								LOG.info("{} Received version: {} my version: {}",
										 self.getId(),
										 Long.toHexString(rqv.getVersion()),
										 Long.toHexString(self.getQuorumVerifier().getVersion()));
								if (self.getPeerState() == ServerState.LOOKING) {
									LOG.debug("Invoking processReconfig(), state: {}", self.getServerState());
									self.processReconfig(rqv, null, null, false);
									if (!rqv.equals(curQV)) {
										LOG.info("restarting leader election");
										self.shuttingDownLE = true;
										self.getElectionAlg().shutdown();

										break;
									}
								} else {
									LOG.debug("Skip processReconfig(), state: {}", self.getServerState());
								}
							}
						} catch (IOException | ConfigException e) {
							LOG.error("Something went wrong while processing config received from {}", response.sid);
						}
					}
				} else {
					LOG.info("Backward compatibility mode (before reconfig), server id: {}", response.sid);
				}
			} catch (BufferUnderflowException | IOException e) {
				LOG.warn("Skipping the processing of a partial / malformed response message sent by sid={} (message length: {})",
						 response.sid, capacity, e);
				continue;
			}

			if (!validVoter(response.sid)) {
				Vote current = self.getCurrentVote();
				QuorumVerifier qv = self.getQuorumVerifier();
				ToSend notmsg = new ToSend(
					ToSend.mType.notification,
					current.getId(),
					current.getZxid(),
					logicalclock.get(),
					self.getPeerState(),
					response.sid,
					current.getPeerEpoch(),
					qv.toString().getBytes(UTF_8));

				sendqueue.offer(notmsg);
			} else {
		
				LOG.debug("Receive new notification message. My id = {}", self.getId());
				QuorumPeer.ServerState ackstate = QuorumPeer.ServerState.LOOKING;
				switch (rstate) {
				case 0:
					ackstate = QuorumPeer.ServerState.LOOKING;
					break;
				case 1:
					ackstate = QuorumPeer.ServerState.FOLLOWING;
					break;
				case 2:
					ackstate = QuorumPeer.ServerState.LEADING;
					break;
				case 3:
					ackstate = QuorumPeer.ServerState.OBSERVING;
					break;
				default:
					continue;
				}

				n.leader = rleader;
				n.zxid = rzxid;
				n.electionEpoch = relectionEpoch;
				n.state = ackstate;
				n.sid = response.sid;
				n.peerEpoch = rpeerepoch;
				n.version = version;
				n.qv = rqv;
		
				LOG.info(
					"Notification: my state:{}; n.sid:{}, n.state:{}, n.leader:{}, n.round:0x{}, "
						+ "n.peerEpoch:0x{}, n.zxid:0x{}, message format version:0x{}, n.config version:0x{}",
					self.getPeerState(),
					n.sid,
					n.state,
					n.leader,
					Long.toHexString(n.electionEpoch),
					Long.toHexString(n.peerEpoch),
					Long.toHexString(n.zxid),
					Long.toHexString(n.version),
					(n.qv != null ? (Long.toHexString(n.qv.getVersion())) : "0"));

				if (self.getPeerState() == QuorumPeer.ServerState.LOOKING) {
					recvqueue.offer(n); // 存recvqueue

					if ((ackstate == QuorumPeer.ServerState.LOOKING)
						&& (n.electionEpoch < logicalclock.get())) {
						Vote v = getVote();
						QuorumVerifier qv = self.getQuorumVerifier();
						ToSend notmsg = new ToSend(
							ToSend.mType.notification,
							v.getId(),
							v.getZxid(),
							logicalclock.get(),
							self.getPeerState(),
							response.sid,
							v.getPeerEpoch(),
							qv.toString().getBytes());
						sendqueue.offer(notmsg);
					}
				} else {
					/*
					 * If this server is not looking, but the one that sent the ack
					 * is looking, then send back what it believes to be the leader.
					 */
					Vote current = self.getCurrentVote();
					if (ackstate == QuorumPeer.ServerState.LOOKING) {
						if (self.leader != null) {
							if (leadingVoteSet != null) {
								self.leader.setLeadingVoteSet(leadingVoteSet);
								leadingVoteSet = null;
							}
							self.leader.reportLookingSid(response.sid);
						}


						LOG.debug(
							"Sending new notification. My id ={} recipient={} zxid=0x{} leader={} config version = {}",
							self.getId(),
							response.sid,
							Long.toHexString(current.getZxid()),
							current.getId(),
							Long.toHexString(self.getQuorumVerifier().getVersion()));

						QuorumVerifier qv = self.getQuorumVerifier();
						ToSend notmsg = new ToSend(
							ToSend.mType.notification,
							current.getId(),
							current.getZxid(),
							current.getElectionEpoch(),
							self.getPeerState(),
							response.sid,
							current.getPeerEpoch(),
							qv.toString().getBytes());
						sendqueue.offer(notmsg);
					}
				}
			}
		} catch (InterruptedException e) {
			LOG.warn("Interrupted Exception while waiting for new message", e);
		}
	}
	LOG.info("WorkerReceiver is down");
}
```

##### 1.5.2 选举开始

跟进`super.start(); `，QuorumPeer也是线程，所以看run方法：

```java
public void run() {
	updateThreadName();

	LOG.debug("Starting quorum peer");
	try {
		jmxQuorumBean = new QuorumBean(this);
		MBeanRegistry.getInstance().register(jmxQuorumBean, null);
		for (QuorumServer s : getView().values()) {
			ZKMBeanInfo p;
			if (getId() == s.id) {
				p = jmxLocalPeerBean = new LocalPeerBean(this);
				try {
					MBeanRegistry.getInstance().register(p, jmxQuorumBean);
				} catch (Exception e) {
					LOG.warn("Failed to register with JMX", e);
					jmxLocalPeerBean = null;
				}
			} else {
				RemotePeerBean rBean = new RemotePeerBean(this, s);
				try {
					MBeanRegistry.getInstance().register(rBean, jmxQuorumBean);
					jmxRemotePeerBean.put(s.id, rBean);
				} catch (Exception e) {
					LOG.warn("Failed to register with JMX", e);
				}
			}
		}
	} catch (Exception e) {
		LOG.warn("Failed to register with JMX", e);
		jmxQuorumBean = null;
	}

	try {
		while (running) {  // 一直循环
			if (unavailableStartTime == 0) {
				unavailableStartTime = Time.currentElapsedTime();
			}

			switch (getPeerState()) {
			case LOOKING: // 刚开始选举状态时都是LOOKING
				LOG.info("LOOKING");
				ServerMetrics.getMetrics().LOOKING_COUNT.add(1);

				if (Boolean.getBoolean("readonlymode.enabled")) {
					LOG.info("Attempting to start ReadOnlyZooKeeperServer");
					final ReadOnlyZooKeeperServer roZk = new ReadOnlyZooKeeperServer(logFactory, this, this.zkDb);
					Thread roZkMgr = new Thread() {
						public void run() {
							try {
								// lower-bound grace period to 2 secs
								sleep(Math.max(2000, tickTime));
								if (ServerState.LOOKING.equals(getPeerState())) {
									roZk.startup();
								}
							} catch (InterruptedException e) {
								LOG.info("Interrupted while attempting to start ReadOnlyZooKeeperServer, not started");
							} catch (Exception e) {
								LOG.error("FAILED to start ReadOnlyZooKeeperServer", e);
							}
						}
					};
					try {
						roZkMgr.start();
						reconfigFlagClear();
						if (shuttingDownLE) {
							shuttingDownLE = false;
							startLeaderElection();
						}
                        // lookForLeader返回选举的leader，设置Leader
						setCurrentVote(makeLEStrategy().lookForLeader());
					} catch (Exception e) {
						LOG.warn("Unexpected exception", e);
						setPeerState(ServerState.LOOKING);
					} finally {
						// If the thread is in the the grace period, interrupt
						// to come out of waiting.
						roZkMgr.interrupt();
						roZk.shutdown();
					}
				} else {
					try {
						reconfigFlagClear();
						if (shuttingDownLE) {
							shuttingDownLE = false;
							startLeaderElection();
						}
						setCurrentVote(makeLEStrategy().lookForLeader());
					} catch (Exception e) {
						LOG.warn("Unexpected exception", e);
						setPeerState(ServerState.LOOKING);
					}
				}
				break;
			case OBSERVING:
				try {
					LOG.info("OBSERVING");
					setObserver(makeObserver(logFactory));
					observer.observeLeader();
				} catch (Exception e) {
					LOG.warn("Unexpected exception", e);
				} finally {
					observer.shutdown();
					setObserver(null);
					updateServerState();

					// Add delay jitter before we switch to LOOKING
					// state to reduce the load of ObserverMaster
					if (isRunning()) {
						Observer.waitForObserverElectionDelay();
					}
				}
				break;
			case FOLLOWING:
				try {
					LOG.info("FOLLOWING");
					setFollower(makeFollower(logFactory));
					follower.followLeader();
				} catch (Exception e) {
					LOG.warn("Unexpected exception", e);
				} finally {
					follower.shutdown();
					setFollower(null);
					updateServerState();
				}
				break;
			case LEADING:
				LOG.info("LEADING");
				try {
					setLeader(makeLeader(logFactory));
					leader.lead();
					setLeader(null);
				} catch (Exception e) {
					LOG.warn("Unexpected exception", e);
				} finally {
					if (leader != null) {
						leader.shutdown("Forcing shutdown");
						setLeader(null);
					}
					updateServerState();
				}
				break;
			}
		}
	} finally {
		LOG.warn("QuorumPeer main thread exited");
		MBeanRegistry instance = MBeanRegistry.getInstance();
		instance.unregister(jmxQuorumBean);
		instance.unregister(jmxLocalPeerBean);

		for (RemotePeerBean remotePeerBean : jmxRemotePeerBean.values()) {
			instance.unregister(remotePeerBean);
		}

		jmxQuorumBean = null;
		jmxLocalPeerBean = null;
		jmxRemotePeerBean = null;
	}
}
```

跟进lookForLeader方法

```java
public Vote lookForLeader() throws InterruptedException {
	try {
		self.jmxLeaderElectionBean = new LeaderElectionBean();
		MBeanRegistry.getInstance().register(self.jmxLeaderElectionBean, self.jmxLocalPeerBean);
	} catch (Exception e) {
		LOG.warn("Failed to register with JMX", e);
		self.jmxLeaderElectionBean = null;
	}

	self.start_fle = Time.currentElapsedTime();
	try {
		Map<Long, Vote> recvset = new HashMap<Long, Vote>();
		Map<Long, Vote> outofelection = new HashMap<Long, Vote>();
		int notTimeout = minNotificationInterval;
		synchronized (this) {
			logicalclock.incrementAndGet();
			updateProposal(getInitId(), getInitLastLoggedZxid(), getPeerEpoch());
		}

		LOG.info(
			"New election. My id = {}, proposed zxid=0x{}",
			self.getId(),
			Long.toHexString(proposedZxid));
		sendNotifications();

		SyncedLearnerTracker voteSet;
        
		while ((self.getPeerState() == ServerState.LOOKING) && (!stop)) {
            // 从recvqueue队列中不停的取出选票
			Notification n = recvqueue.poll(notTimeout, TimeUnit.MILLISECONDS);
			if (n == null) {
				if (manager.haveDelivered()) {
					sendNotifications();
				} else {
					manager.connectAll();
				}

				int tmpTimeOut = notTimeout * 2;
				notTimeout = Math.min(tmpTimeOut, maxNotificationInterval);
				LOG.info("Notification time out: {}", notTimeout);
			} else if (validVoter(n.sid) && validVoter(n.leader)) {
				switch (n.state) {
				case LOOKING:// 判断当前机器是不是还处于选举状态
					if (getInitLastLoggedZxid() == -1) {
						LOG.debug("Ignoring notification as our zxid is -1");
						break;
					}
					if (n.zxid == -1) {
						LOG.debug("Ignoring notification from member with -1 zxid {}", n.sid);
						break;
					}

					if (n.electionEpoch > logicalclock.get()) { 
						logicalclock.set(n.electionEpoch);
						recvset.clear();
                        // totalOrderPredicate选举规则
						if (totalOrderPredicate(n.leader, n.zxid, n.peerEpoch, getInitId(), getInitLastLoggedZxid(), getPeerEpoch())) { // 和自己比较
							updateProposal(n.leader, n.zxid, n.peerEpoch);
						} else { // 更新选票，把选票从队列中取出，通过totalOrderPredicate选举规则比较后确定自己投谁
							updateProposal(getInitId(), getInitLastLoggedZxid(), getPeerEpoch());
						}
						sendNotifications(); // 广播选票
					} else if (n.electionEpoch < logicalclock.get()) { // 选票过时弃票
							LOG.debug(
								"Notification election epoch is smaller than logicalclock. n.electionEpoch = 0x{}, logicalclock=0x{}",
								Long.toHexString(n.electionEpoch),
								Long.toHexString(logicalclock.get()));
						break;
					} else if (totalOrderPredicate(n.leader, n.zxid, n.peerEpoch, proposedLeader, proposedZxid, proposedEpoch)) { // 和自己通过选举规则比较后选出来的老大比较
						updateProposal(n.leader, n.zxid, n.peerEpoch);
						sendNotifications();
					}

					LOG.debug(
						"Adding vote: from={}, proposed leader={}, proposed zxid=0x{}, proposed election epoch=0x{}",
						n.sid,
						n.leader,
						Long.toHexString(n.zxid),
						Long.toHexString(n.electionEpoch));

					recvset.put(n.sid, new Vote(n.leader, n.zxid, n.electionEpoch, n.peerEpoch));

					voteSet = getVoteTracker(recvset, new Vote(proposedLeader, proposedZxid, logicalclock.get(), proposedEpoch));

					if (voteSet.hasAllQuorums()) {
						// 选举期间还是在不停的取出选票
						while ((n = recvqueue.poll(finalizeWait, TimeUnit.MILLISECONDS)) != null) {
							// totalOrderPredicate进行选票的pk
                            if (totalOrderPredicate(n.leader, n.zxid, n.peerEpoch, proposedLeader, proposedZxid, proposedEpoch)) {
								recvqueue.put(n);
								break;
							}
						}

						if (n == null) {
							setPeerState(proposedLeader, voteSet);
							Vote endVote = new Vote(proposedLeader, proposedZxid, logicalclock.get(), proposedEpoch);
							leaveInstance(endVote);
							return endVote;
						}
					}
					break;
				case OBSERVING:
					LOG.debug("Notification from observer: {}", n.sid);
					break;
				case FOLLOWING:
				case LEADING: // 已经确定自己是FOLLOWING还是LEADING

					if (n.electionEpoch == logicalclock.get()) {
						recvset.put(n.sid, new Vote(n.leader, n.zxid, n.electionEpoch, n.peerEpoch, n.state));
						voteSet = getVoteTracker(recvset, new Vote(n.version, n.leader, n.zxid, n.electionEpoch, n.peerEpoch, n.state));
						if (voteSet.hasAllQuorums() && checkLeader(recvset, n.leader, n.electionEpoch)) {
							setPeerState(n.leader, voteSet);
							Vote endVote = new Vote(n.leader, n.zxid, n.electionEpoch, n.peerEpoch);
							leaveInstance(endVote);
							return endVote;
						}
					}

					outofelection.put(n.sid, new Vote(n.version, n.leader, n.zxid, n.electionEpoch, n.peerEpoch, n.state));
					voteSet = getVoteTracker(outofelection, new Vote(n.version, n.leader, n.zxid, n.electionEpoch, n.peerEpoch, n.state));

					if (voteSet.hasAllQuorums() && checkLeader(outofelection, n.leader, n.electionEpoch)) {
						synchronized (this) {
							logicalclock.set(n.electionEpoch);
							setPeerState(n.leader, voteSet);
						}
						Vote endVote = new Vote(n.leader, n.zxid, n.electionEpoch, n.peerEpoch);
						leaveInstance(endVote);
						return endVote;
					}
					break;
				default:
					LOG.warn("Notification state unrecognized: {} (n.state), {}(n.sid)", n.state, n.sid);
					break;
				}
			} else {
				if (!validVoter(n.leader)) {
					LOG.warn("Ignoring notification for non-cluster member sid {} from sid {}", n.leader, n.sid);
				}
				if (!validVoter(n.sid)) {
					LOG.warn("Ignoring notification for sid {} from non-quorum member sid {}", n.leader, n.sid);
				}
			}
		}
		return null;
	} finally {
		try {
			if (self.jmxLeaderElectionBean != null) {
				MBeanRegistry.getInstance().unregister(self.jmxLeaderElectionBean);
			}
		} catch (Exception e) {
			LOG.warn("Failed to unregister with JMX", e);
		}
		self.jmxLeaderElectionBean = null;
		LOG.debug("Number of connection processing threads: {}", manager.getConnectionThreadCount());
	}
}
```

totalOrderPredicate方法选举规则：

```java
protected boolean totalOrderPredicate(long newId, long newZxid, long newEpoch, long curId, long curZxid, long curEpoch) {
	LOG.debug(
		"id: {}, proposed id: {}, zxid: 0x{}, proposed zxid: 0x{}",
		newId,
		curId,
		Long.toHexString(newZxid),
		Long.toHexString(curZxid));

	if (self.getQuorumVerifier().getWeight(newId) == 0) {
		return false;
	}

    //①，EPOCH大的直接胜出;②，EPOCH相同，事务id大的胜出 ③，事务id相同，服务器myid大的胜出
	return ((newEpoch > curEpoch)
			|| ((newEpoch == curEpoch)
				&& ((newZxid > curZxid)
					|| ((newZxid == curZxid)
						&& (newId > curId)))));
}
```

updateProposal方法更新选票的源码：

```java
synchronized void updateProposal(long leader, long zxid, long epoch) {
	LOG.debug(
		"Updating proposal: {} (newleader), 0x{} (newzxid), {} (oldleader), 0x{} (oldzxid)",
		leader,
		Long.toHexString(zxid),
		proposedLeader,
		Long.toHexString(proposedZxid));

	proposedLeader = leader;
	proposedZxid = zxid;
	proposedEpoch = epoch;
}
```

`sendNotifications();`方法广播选票的源码：

```java
private void sendNotifications() {
	for (long sid : self.getCurrentAndNextConfigVoters()) {
		QuorumVerifier qv = self.getQuorumVerifier();
        // 创建选票信息
		ToSend notmsg = new ToSend(
			ToSend.mType.notification,
			proposedLeader,
			proposedZxid,
			logicalclock.get(),
			QuorumPeer.ServerState.LOOKING,
			sid,
			proposedEpoch,
			qv.toString().getBytes(UTF_8));

		LOG.debug(
			"Sending Notification: {} (n.leader), 0x{} (n.zxid), 0x{} (n.round), {} (recipient),"
				+ " {} (myid), 0x{} (n.peerEpoch) ",
			proposedLeader,
			Long.toHexString(proposedZxid),
			Long.toHexString(logicalclock.get()),
			sid,
			self.getId(),
			Long.toHexString(proposedEpoch));
		// 存入发送队列sendqueue，WorkerSender的run方法会取值的，可以回头看看上面WorkerSender的run方法
		sendqueue.offer(notmsg);
	}
}
```

##### 1.5.3 选举机制总结

选举机制中的概念：

- SID：服务器ID。用来唯一标识一台 ZooKeeper集群中的机器，每台机器不能重 复，和myid一致。 

- ZXID：事务ID。ZXID是一个事务ID，用来标识一次服务器状态的变更。在某一时刻， 集群中的每台机器的ZXID值不一定完全一 致，这和ZooKeeper服务器对于客户端“更新请求”的处理逻辑有关。 

- Epoch：每个Leader任期的代号。没有 Leader时同一轮投票过程中的逻辑时钟值是相同的。每投完一次票这个数据就会增加
- LOOKING：选举中，正在寻找Leader
- FOLLOWING：随从状态，同步leader状态，参与投票
- Leader：领导者，差不多是master，在zookeeper中只有leader才有写的权限，following只有读的权限
- OBSERVING：观察者状态，不同leader状态，不参与投票

第一次启动：

- 服务器1启动，发起一次选举。服务器1投自己一票。此时服务器1票数一票，不够半数以上（3票），选举无法完成，服务器1状态保持为 LOOKING； 
- 服务器2启动，再发起一次选举。服务器2也投自己一票，并交换选票信息：此时服务器1发现服务器2的myid比自己myid 大，服务器1会更改选票，推举服务器2。此时服务器1票数0票，服务器2票数2票，没有半数以上结果，选举无法完成，服务器1，2状态保持LOOKING；
- 服务器3启动，再发起一次选举。此时服务器1和2都会更改选票为服务器3。此次投票结果：服务器1为0票，服务器2为0票，服务器3为3票。此时服 务器3的票数已经超过半数，服务器3当选Leader。服务器1，2更改状态为FOLLOWING，服务器3更改状态为LEADING；
- 服务器4启动，发起一次选举。此时服务器1，2，3已经不是LOOKING状态，不会更改选票信息。交换选票信息结果：服务器3为3票，服务器4为 1票。此时服务器4服从多数，更改选票信息为服务器3，并更改状态为FOLLOWING； 
- 服务器5启动，同服务器4一样服从多数，更改选票信息为服务器3，并更改状态为FOLLOWING；

非第一次启动：

当ZooKeeper集群中的一台服务器在运行期间无法和Leader保持连接，会开始进入Leader选举，在进入Leader选举流程时，当前集群可能会处于以下两种状态：

- 集群中本来就已经存在一个Leader。 对于第一种已经存在Leader的情况，机器试图去选举Leader时，会被告知当前服务器的Leader信息，对于该机器来说，仅仅需要和Leader机器建立连接，并进行状态同步即可。 

- 集群中确实不存在Leader。 

假设：ZooKeeper由5台服务器组成，SID分别为1、2、3、4、5，并且此时SID为3的服务器是Leader，某一时刻，3和5服务器出现故障，假设当前1、2、4的EPOCH，ZXID，SID如下表，最终选出的Leader应该是2：

| SID  | ZXID | EPOCH |
| ---- | ---- | ----- |
| 1    | 8    | 1     |
| 2    | 8    | 1     |
| 4    | 7    | 1     |

总结选举Leader规则： 

- ①，EPOCH大的直接胜出 
- ②，EPOCH相同，事务id大的胜出 
- ③，事务id相同，服务器myid大的胜出

#### 1.6 Leader 状态同步源码

当选举结束后，每个节点都需要根据自己的角色更新自己的状态。选举出的 Leader 更 新自己状态为 Leader，其他节点更新自己状态为 Follower。

Leader 更新状态入口是，QuorumPeer的run方法中case LOOKING是上面选举的流程，case LEADING是Leader 状态同步流程：

```java
case LEADING:
	LOG.info("LEADING");
	try {
		setLeader(makeLeader(logFactory));
		leader.lead(); // 调用leader的lead()
		setLeader(null);
	} catch (Exception e) {
		LOG.warn("Unexpected exception", e);
	} finally {
		if (leader != null) {
			leader.shutdown("Forcing shutdown");
			setLeader(null);
		}
		updateServerState();
	}
	break;

```



```java
void lead() throws IOException, InterruptedException {
	self.end_fle = Time.currentElapsedTime();
	long electionTimeTaken = self.end_fle - self.start_fle;
	self.setElectionTimeTaken(electionTimeTaken);
	ServerMetrics.getMetrics().ELECTION_TIME.add(electionTimeTaken);
	LOG.info("LEADING - LEADER ELECTION TOOK - {} {}", electionTimeTaken, QuorumPeer.FLE_TIME_UNIT);
	self.start_fle = 0;
	self.end_fle = 0;

	zk.registerJMX(new LeaderBean(this, zk), self.jmxLocalPeerBean);

	try {
		self.setZabState(QuorumPeer.ZabState.DISCOVERY);
		self.tick.set(0);
		zk.loadData(); // 恢复数据到内存，启动时，其实已经加载过了
		leaderStateSummary = new StateSummary(self.getCurrentEpoch(), zk.getLastProcessedZxid());
		cnxAcceptor = new LearnerCnxAcceptor();
		cnxAcceptor.start(); // 等待其他 follower 节点向 leader 节点发送同步状态
		long epoch = getEpochToPropose(self.getId(), self.getAcceptedEpoch());
		// ......省略部分代码
	} finally {
		zk.unregisterJMX(this);
	}
}
```

LearnerCnxAccepto是线程的start方法，调用LearnerCnxAccepto的run方法：

```java
public void run() {
	if (!stop.get() && !serverSockets.isEmpty()) {
		ExecutorService executor = Executors.newFixedThreadPool(serverSockets.size());
		CountDownLatch latch = new CountDownLatch(serverSockets.size());
		// 通过线程池的方式提交任务，所以查看LearnerCnxAcceptorHandler的run方法
		serverSockets.forEach(serverSocket ->
				executor.submit(new LearnerCnxAcceptorHandler(serverSocket, latch)));

		try {
			latch.await();
		} catch (InterruptedException ie) {
			LOG.error("Interrupted while sleeping in LearnerCnxAcceptor.", ie);
		} finally {
			closeSockets();
			executor.shutdown();
			try {
				if (!executor.awaitTermination(1, TimeUnit.SECONDS)) {
					LOG.error("not all the LearnerCnxAcceptorHandler terminated properly");
				}
			} catch (InterruptedException ie) {
				LOG.error("Interrupted while terminating LearnerCnxAcceptor.", ie);
			}
		}
	}
}
```

查看LearnerCnxAcceptorHandler的run方法：

```java
public void run() {
	try {
		Thread.currentThread().setName("LearnerCnxAcceptorHandler-" + serverSocket.getLocalSocketAddress());
		while (!stop.get()) { // 没有停止
			acceptConnections(); // 跟进
		}
	} catch (Exception e) {
		LOG.warn("Exception while accepting follower", e);
		if (fail.compareAndSet(false, true)) {
			handleException(getName(), e);
			halt();
		}
	} finally {
		latch.countDown();
	}
}
// 继续acceptConnections();方法
private void acceptConnections() throws IOException {
	Socket socket = null;
	boolean error = false;
	try {
		socket = serverSocket.accept(); // 第一步：等待接收 follower 的状态同步申请
		socket.setSoTimeout(self.tickTime * self.initLimit);
		socket.setTcpNoDelay(nodelay);
		BufferedInputStream is = new BufferedInputStream(socket.getInputStream());
        // 一旦接收到 follower 的请求，就创建 LearnerHandler 对象，处理请求
		LearnerHandler fh = new LearnerHandler(socket, is, Leader.this);
		fh.start(); //  启动线程
	} catch (SocketException e) {
		error = true;
		if (stop.get()) {
			LOG.warn("Exception while shutting down acceptor.", e);
		} else {
			throw e;
		}
	} catch (SaslException e) {
		LOG.error("Exception while connecting to quorum learner", e);
		error = true;
	} catch (Exception e) {
		error = true;
		throw e;
	} finally {
		// Don't leak sockets on errors
		if (error && socket != null && !socket.isClosed()) {
			try {
				socket.close();
			} catch (IOException e) {
				LOG.warn("Error closing socket: " + socket, e);
			}
		}
	}
}

```

LearnerHandler是线程，调用start()方法，查看其run方法：

```java
public void run() {
	try {
		learnerMaster.addLearnerHandler(this);
        // 心跳处理
		tickOfNextAckDeadline = learnerMaster.getTickOfInitialAckDeadline();

		ia = BinaryInputArchive.getArchive(bufferedInput);
		bufferedOutput = new BufferedOutputStream(sock.getOutputStream());
		oa = BinaryOutputArchive.getArchive(bufferedOutput);
        
		// 从网络中接收消息，并反序列化为 packet
		QuorumPacket qp = new QuorumPacket();
		ia.readRecord(qp, "packet");

		messageTracker.trackReceived(qp.getType()); // 接收数据
        // 选举结束后，observer 和 follower 都会给leader发送一个标志信息：FOLLOWERINFO 或者 OBSERVERINFO
		if (qp.getType() != Leader.FOLLOWERINFO && qp.getType() != Leader.OBSERVERINFO) {
			LOG.error("First packet {} is not FOLLOWERINFO or OBSERVERINFO!", qp.toString());
			return;
		}

		if (learnerMaster instanceof ObserverMaster && qp.getType() != Leader.OBSERVERINFO) {
			throw new IOException("Non observer attempting to connect to ObserverMaster. type = " + qp.getType());
		}
		byte[] learnerInfoData = qp.getData();
		if (learnerInfoData != null) {
			ByteBuffer bbsid = ByteBuffer.wrap(learnerInfoData);
			if (learnerInfoData.length >= 8) {
				this.sid = bbsid.getLong();
			}
			if (learnerInfoData.length >= 12) {
				this.version = bbsid.getInt(); // protocolVersion
			}
			if (learnerInfoData.length >= 20) {
				long configVersion = bbsid.getLong();
				if (configVersion > learnerMaster.getQuorumVerifierVersion()) {
					throw new IOException("Follower is ahead of the leader (has a later activated configuration)");
				}
			}
		} else {
			this.sid = learnerMaster.getAndDecrementFollowerCounter();
		}

		String followerInfo = learnerMaster.getPeerInfo(this.sid);
		if (followerInfo.isEmpty()) {
			LOG.info(
				"Follower sid: {} not in the current config {}",
				this.sid,
				Long.toHexString(learnerMaster.getQuorumVerifierVersion()));
		} else {
			LOG.info("Follower sid: {} : info : {}", this.sid, followerInfo);
		}

		if (qp.getType() == Leader.OBSERVERINFO) {
			learnerType = LearnerType.OBSERVER;
		}

		learnerMaster.registerLearnerHandlerBean(this, sock);
		// 第二步：读取 Follower 发送过来的 lastAcceptedEpoch
		// 选举过程中，所使用的 epoch，其实还是上一任 leader 的 epoch
		long lastAcceptedEpoch = ZxidUtils.getEpochFromZxid(qp.getZxid());

		long peerLastZxid;
		StateSummary ss = null;
        // 读取 follower 发送过来的 zxid
		long zxid = qp.getZxid();
        // Leader 根据从 Follower 获取 sid 和旧的 epoch，构建新的 epoch
		long newEpoch = learnerMaster.getEpochToPropose(this.getSid(), lastAcceptedEpoch);
		long newLeaderZxid = ZxidUtils.makeZxid(newEpoch, 0);

		if (this.getVersion() < 0x10000) {
			// we are going to have to extrapolate the epoch information
			long epoch = ZxidUtils.getEpochFromZxid(zxid);
			ss = new StateSummary(epoch, zxid);
			// fake the message
			learnerMaster.waitForEpochAck(this.getSid(), ss);
		} else {
			byte[] ver = new byte[4];
			ByteBuffer.wrap(ver).putInt(0x10000);
            // Leader 向 Follower 发送信息（包含:zxid 和 newEpoch）
			QuorumPacket newEpochPacket = new QuorumPacket(Leader.LEADERINFO, newLeaderZxid, ver, null);
			oa.writeRecord(newEpochPacket, "packet"); // 发送信息
			messageTracker.trackSent(Leader.LEADERINFO);
			bufferedOutput.flush();
            // 等待Follower发送ACK确认
			QuorumPacket ackEpochPacket = new QuorumPacket();
			ia.readRecord(ackEpochPacket, "packet");
			messageTracker.trackReceived(ackEpochPacket.getType());
			if (ackEpochPacket.getType() != Leader.ACKEPOCH) {
				LOG.error("{} is not ACKEPOCH", ackEpochPacket.toString());
				return;
			}
			ByteBuffer bbepoch = ByteBuffer.wrap(ackEpochPacket.getData());
			ss = new StateSummary(bbepoch.getInt(), ackEpochPacket.getZxid());
           
			learnerMaster.waitForEpochAck(this.getSid(), ss); 
		}
		peerLastZxid = ss.getLastZxid();
        // 判断Leader和follow是否需要同步数据
		boolean needSnap = syncFollower(peerLastZxid, learnerMaster);
		boolean exemptFromThrottle = getLearnerType() != LearnerType.OBSERVER;

		if (needSnap) {
			syncThrottler = learnerMaster.getLearnerSnapSyncThrottler();
			syncThrottler.beginSync(exemptFromThrottle);
			ServerMetrics.getMetrics().INFLIGHT_SNAP_COUNT.add(syncThrottler.getSyncInProgress());
			try {
				long zxidToSend = learnerMaster.getZKDatabase().getDataTreeLastProcessedZxid();
				oa.writeRecord(new QuorumPacket(Leader.SNAP, zxidToSend, null, null), "packet");
                
				messageTracker.trackSent(Leader.SNAP);
				bufferedOutput.flush();

				LOG.info(
					"Sending snapshot last zxid of peer is 0x{}, zxid of leader is 0x{}, "
						+ "send zxid of db as 0x{}, {} concurrent snapshot sync, "
						+ "snapshot sync was {} from throttle",
					Long.toHexString(peerLastZxid),
					Long.toHexString(leaderLastZxid),
					Long.toHexString(zxidToSend),
					syncThrottler.getSyncInProgress(),
					exemptFromThrottle ? "exempt" : "not exempt");
				// Dump data to peer
				learnerMaster.getZKDatabase().serializeSnapshot(oa);
				oa.writeString("BenWasHere", "signature");
				bufferedOutput.flush();
			} finally {
				ServerMetrics.getMetrics().SNAP_COUNT.add(1);
			}
		} else {
			syncThrottler = learnerMaster.getLearnerDiffSyncThrottler();
			syncThrottler.beginSync(exemptFromThrottle);
			ServerMetrics.getMetrics().INFLIGHT_DIFF_COUNT.add(syncThrottler.getSyncInProgress());
			ServerMetrics.getMetrics().DIFF_COUNT.add(1);
		}

		LOG.debug("Sending NEWLEADER message to {}", sid);

		if (getVersion() < 0x10000) {
			QuorumPacket newLeaderQP = new QuorumPacket(Leader.NEWLEADER, newLeaderZxid, null, null);
			oa.writeRecord(newLeaderQP, "packet");
		} else {
			QuorumPacket newLeaderQP = new QuorumPacket(Leader.NEWLEADER, newLeaderZxid, learnerMaster.getQuorumVerifierBytes(), null);
			queuedPackets.add(newLeaderQP);
		}
		bufferedOutput.flush();

		// Start thread that blast packets in the queue to learner
		startSendingPackets();

		qp = new QuorumPacket();
		ia.readRecord(qp, "packet");

		messageTracker.trackReceived(qp.getType());
		if (qp.getType() != Leader.ACK) {
			LOG.error("Next packet was supposed to be an ACK, but received packet: {}", packetToString(qp));
			return;
		}

		LOG.debug("Received NEWLEADER-ACK message from {}", sid);

		learnerMaster.waitForNewLeaderAck(getSid(), qp.getZxid());

		syncLimitCheck.start();
		// sync ends when NEWLEADER-ACK is received
		syncThrottler.endSync();
		if (needSnap) {
			ServerMetrics.getMetrics().INFLIGHT_SNAP_COUNT.add(syncThrottler.getSyncInProgress());
		} else {
			ServerMetrics.getMetrics().INFLIGHT_DIFF_COUNT.add(syncThrottler.getSyncInProgress());
		}
		syncThrottler = null;

		// now that the ack has been processed expect the syncLimit
		sock.setSoTimeout(learnerMaster.syncTimeout());


		learnerMaster.waitForStartup();


		LOG.debug("Sending UPTODATE message to {}", sid);
		queuedPackets.add(new QuorumPacket(Leader.UPTODATE, -1, null, null)); // 更新数据

		while (true) {
			qp = new QuorumPacket();
			ia.readRecord(qp, "packet");
			messageTracker.trackReceived(qp.getType());

			long traceMask = ZooTrace.SERVER_PACKET_TRACE_MASK;
			if (qp.getType() == Leader.PING) {
				traceMask = ZooTrace.SERVER_PING_TRACE_MASK;
			}
			if (LOG.isTraceEnabled()) {
				ZooTrace.logQuorumPacket(LOG, traceMask, 'i', qp);
			}
			tickOfNextAckDeadline = learnerMaster.getTickOfNextAckDeadline();

			packetsReceived.incrementAndGet();

			ByteBuffer bb;
			long sessionId;
			int cxid;
			int type;

			switch (qp.getType()) {
			case Leader.ACK:
				if (this.learnerType == LearnerType.OBSERVER) {
					LOG.debug("Received ACK from Observer {}", this.sid);
				}
				syncLimitCheck.updateAck(qp.getZxid());
				learnerMaster.processAck(this.sid, qp.getZxid(), sock.getLocalSocketAddress());
				break;
			case Leader.PING:
				// Process the touches
				ByteArrayInputStream bis = new ByteArrayInputStream(qp.getData());
				DataInputStream dis = new DataInputStream(bis);
				while (dis.available() > 0) {
					long sess = dis.readLong();
					int to = dis.readInt();
					learnerMaster.touch(sess, to);
				}
				break;
			case Leader.REVALIDATE:
				ServerMetrics.getMetrics().REVALIDATE_COUNT.add(1);
				learnerMaster.revalidateSession(qp, this);
				break;
			case Leader.REQUEST:
				bb = ByteBuffer.wrap(qp.getData());
				sessionId = bb.getLong();
				cxid = bb.getInt();
				type = bb.getInt();
				bb = bb.slice();
				Request si;
				if (type == OpCode.sync) {
					si = new LearnerSyncRequest(this, sessionId, cxid, type, bb, qp.getAuthinfo());
				} else {
					si = new Request(null, sessionId, cxid, type, bb, qp.getAuthinfo());
				}
				si.setOwner(this);
				learnerMaster.submitLearnerRequest(si);
				requestsReceived.incrementAndGet();
				break;
			default:
				LOG.warn("unexpected quorum packet, type: {}", packetToString(qp));
				break;
			}
		}
	} catch (IOException e) {
		LOG.error("Unexpected exception in LearnerHandler: ", e);
		closeSocket();
	} catch (InterruptedException e) {
		LOG.error("Unexpected exception in LearnerHandler.", e);
	} catch (SyncThrottleException e) {
		LOG.error("too many concurrent sync.", e);
		syncThrottler = null;
	} catch (Exception e) {
		LOG.error("Unexpected exception in LearnerHandler.", e);
		throw e;
	} finally {
		if (syncThrottler != null) {
			syncThrottler.endSync();
			syncThrottler = null;
		}
		String remoteAddr = getRemoteAddress();
		LOG.warn("******* GOODBYE {} ********", remoteAddr);
		messageTracker.dumpToLog(remoteAddr);
		shutdown();
	}
}
```

判断Leader和follow是否需要同步数据，跟进syncFollower方法

```java
boolean syncFollower(long peerLastZxid, LearnerMaster learnerMaster) {
	boolean isPeerNewEpochZxid = (peerLastZxid & 0xffffffffL) == 0;
	long currentZxid = peerLastZxid;
	boolean needSnap = true;
	ZKDatabase db = learnerMaster.getZKDatabase();
	boolean txnLogSyncEnabled = db.isTxnLogSyncEnabled();
	ReentrantReadWriteLock lock = db.getLogLock();
	ReadLock rl = lock.readLock();
	try {
		rl.lock();
		long maxCommittedLog = db.getmaxCommittedLog();
		long minCommittedLog = db.getminCommittedLog();
		long lastProcessedZxid = db.getDataTreeLastProcessedZxid();

		LOG.info("Synchronizing with Learner sid: {} maxCommittedLog=0x{}"
				 + " minCommittedLog=0x{} lastProcessedZxid=0x{}"
				 + " peerLastZxid=0x{}",
				 getSid(),
				 Long.toHexString(maxCommittedLog),
				 Long.toHexString(minCommittedLog),
				 Long.toHexString(lastProcessedZxid),
				 Long.toHexString(peerLastZxid));

		if (db.getCommittedLog().isEmpty()) {
			
			minCommittedLog = lastProcessedZxid;
			maxCommittedLog = lastProcessedZxid;
		}
		if (forceSnapSync) {
			LOG.warn("Forcing snapshot sync - should not see this in production");
		} else if (lastProcessedZxid == peerLastZxid) {
			LOG.info(
				"Sending DIFF zxid=0x{} for peer sid: {}",
				Long.toHexString(peerLastZxid),
				getSid());
			queueOpPacket(Leader.DIFF, peerLastZxid);
			needOpPacket = false;
			needSnap = false;
		} else if (peerLastZxid > maxCommittedLog && !isPeerNewEpochZxid) {
			LOG.debug(
				"Sending TRUNC to follower zxidToSend=0x{} for peer sid:{}",
				Long.toHexString(maxCommittedLog),
				getSid());
			queueOpPacket(Leader.TRUNC, maxCommittedLog);
			currentZxid = maxCommittedLog;
			needOpPacket = false;
			needSnap = false;
		} else if ((maxCommittedLog >= peerLastZxid) && (minCommittedLog <= peerLastZxid)) {
			LOG.info("Using committedLog for peer sid: {}", getSid());
			Iterator<Proposal> itr = db.getCommittedLog().iterator();
            // 提交选票提案
			currentZxid = queueCommittedProposals(itr, peerLastZxid, null, maxCommittedLog);
			needSnap = false;
		} else if (peerLastZxid < minCommittedLog && txnLogSyncEnabled) {
			long sizeLimit = db.calculateTxnLogSizeLimit();
			Iterator<Proposal> txnLogItr = db.getProposalsFromTxnLog(peerLastZxid, sizeLimit);
			if (txnLogItr.hasNext()) {
				LOG.info("Use txnlog and committedLog for peer sid: {}", getSid());
				currentZxid = queueCommittedProposals(txnLogItr, peerLastZxid, minCommittedLog, maxCommittedLog);

				if (currentZxid < minCommittedLog) {
					LOG.info(
						"Detected gap between end of txnlog: 0x{} and start of committedLog: 0x{}",
						Long.toHexString(currentZxid),
						Long.toHexString(minCommittedLog));
					currentZxid = peerLastZxid;
					// Clear out currently queued requests and revert
					// to sending a snapshot.
					queuedPackets.clear();
					needOpPacket = true;
				} else {
					LOG.debug("Queueing committedLog 0x{}", Long.toHexString(currentZxid));
					Iterator<Proposal> committedLogItr = db.getCommittedLog().iterator();
					currentZxid = queueCommittedProposals(committedLogItr, currentZxid, null, maxCommittedLog);
					needSnap = false;
				}
			}
			// closing the resources
			if (txnLogItr instanceof TxnLogProposalIterator) {
				TxnLogProposalIterator txnProposalItr = (TxnLogProposalIterator) txnLogItr;
				txnProposalItr.close();
			}
		} else {
			LOG.warn(
				"Unhandled scenario for peer sid: {} maxCommittedLog=0x{}"
					+ " minCommittedLog=0x{} lastProcessedZxid=0x{}"
					+ " peerLastZxid=0x{} txnLogSyncEnabled={}",
				getSid(),
				Long.toHexString(maxCommittedLog),
				Long.toHexString(minCommittedLog),
				Long.toHexString(lastProcessedZxid),
				Long.toHexString(peerLastZxid),
				txnLogSyncEnabled);
		}
		if (needSnap) {
			currentZxid = db.getDataTreeLastProcessedZxid();
		}

		LOG.debug("Start forwarding 0x{} for peer sid: {}", Long.toHexString(currentZxid), getSid());
		leaderLastZxid = learnerMaster.startForwarding(this, currentZxid);
	} finally {
		rl.unlock();
	}

	if (needOpPacket && !needSnap) {
		// This should never happen, but we should fall back to sending
		// snapshot just in case.
		LOG.error("Unhandled scenario for peer sid: {} fall back to use snapshot",  getSid());
		needSnap = true;
	}

	return needSnap;
}
```

serverSocket的初始化是在Leader的构造方法中实现的：

```java
public Leader(QuorumPeer self, LeaderZooKeeperServer zk) throws IOException {
	this.self = self;
	this.proposalStats = new BufferStats();
	Set<InetSocketAddress> addresses;
	if (self.getQuorumListenOnAllIPs()) {
		addresses = self.getQuorumAddress().getWildcardAddresses();
	} else {
		addresses = self.getQuorumAddress().getAllAddresses();
	}
    // 创建createServerSocket，绑定的是同步端口
	addresses.stream()
	  .map(address -> createServerSocket(address, self.shouldUsePortUnification(), self.isSslQuorum()))
	  .filter(Optional::isPresent)
	  .map(Optional::get)
	  .forEach(serverSockets::add);

	if (serverSockets.isEmpty()) {
		throw new IOException("Leader failed to initialize any of the following sockets: " + addresses);
	}

	this.zk = zk;
}
```

#### 1.7 Follower 状态同步源码

QuorumPeer的run方法中case LOOKING是上面选举的流程，case LEADING是Leader 状态同步流程，case FOLLOWING是Follower 状态同步流程：

```java
case FOLLOWING:
	try {
		LOG.info("FOLLOWING");
		setFollower(makeFollower(logFactory));
		follower.followLeader();
	} catch (Exception e) {
		LOG.warn("Unexpected exception", e);
	} finally {
		follower.shutdown();
		setFollower(null);
		updateServerState();
	}
	break;
```

跟进`follower.followLeader();`方法：

```java
void followLeader() throws InterruptedException {
	self.end_fle = Time.currentElapsedTime();
	long electionTimeTaken = self.end_fle - self.start_fle;
	self.setElectionTimeTaken(electionTimeTaken);
	ServerMetrics.getMetrics().ELECTION_TIME.add(electionTimeTaken);
	LOG.info("FOLLOWING - LEADER ELECTION TOOK - {} {}", electionTimeTaken, QuorumPeer.FLE_TIME_UNIT);
	self.start_fle = 0;
	self.end_fle = 0;
	fzk.registerJMX(new FollowerBean(this, zk), self.jmxLocalPeerBean);

	long connectionTime = 0;
	boolean completedSync = false;

	try {
		self.setZabState(QuorumPeer.ZabState.DISCOVERY);
        // 查找leader
		QuorumServer leaderServer = findLeader();
		try {
            // 连接 leader
			connectToLeader(leaderServer.addr, leaderServer.hostname);
			connectionTime = System.currentTimeMillis();
            // 向leader注册
			long newEpochZxid = registerWithLeader(Leader.FOLLOWERINFO);
			if (self.isReconfigStateChange()) {
				throw new Exception("learned about role change");
			}
			long newEpoch = ZxidUtils.getEpochFromZxid(newEpochZxid);
			if (newEpoch < self.getAcceptedEpoch()) {
				LOG.error("Proposed leader epoch "
						  + ZxidUtils.zxidToString(newEpochZxid)
						  + " is less than our accepted epoch "
						  + ZxidUtils.zxidToString(self.getAcceptedEpoch()));
				throw new IOException("Error: Epoch of leader is lower");
			}
			long startTime = Time.currentElapsedTime();
			try {
				self.setLeaderAddressAndId(leaderServer.addr, leaderServer.getId());
				self.setZabState(QuorumPeer.ZabState.SYNCHRONIZATION);
				syncWithLeader(newEpochZxid);
				self.setZabState(QuorumPeer.ZabState.BROADCAST);
				completedSync = true;
			} finally {
				long syncTime = Time.currentElapsedTime() - startTime;
				ServerMetrics.getMetrics().FOLLOWER_SYNC_TIME.add(syncTime);
			}
			if (self.getObserverMasterPort() > 0) {
				LOG.info("Starting ObserverMaster");

				om = new ObserverMaster(self, fzk, self.getObserverMasterPort());
				om.start();
			} else {
				om = null;
			}
			QuorumPacket qp = new QuorumPacket();
			while (this.isRunning()) { // 循环等待消息
				readPacket(qp); // 读取 packet 信息
				processPacket(qp); // 处理 packet 信息，处理提案信息
			}
		} catch (Exception e) {
			LOG.warn("Exception when following the leader", e);
			closeSocket();

			// clear pending revalidations
			pendingRevalidations.clear();
		}
	} finally {
		if (om != null) {
			om.stop();
		}
		zk.unregisterJMX(this);

		if (connectionTime != 0) {
			long connectionDuration = System.currentTimeMillis() - connectionTime;
			LOG.info(
				"Disconnected from leader (with address: {}). Was connected for {}ms. Sync state: {}",
				leaderAddr,
				connectionDuration,
				completedSync);
			messageTracker.dumpToLog(leaderAddr.toString());
		}
	}
}
```

查找leader跟进` findLeader();`方法：

```java
protected QuorumServer findLeader() {
	QuorumServer leaderServer = null;
	// 获取当前的选票信息
	Vote current = self.getCurrentVote();
	for (QuorumServer s : self.getView().values()) { // 如果这个 sid 在启动的所有服务器范围中
		if (s.id == current.getId()) { 
			s.recreateSocketAddresses();// 尝试连接 leader 的正确 IP 地址
			leaderServer = s;
			break;
		}
	}
	if (leaderServer == null) {
		LOG.warn("Couldn't find the leader with id = {}", current.getId());
	}
	return leaderServer;
}
```





向leader注册，跟进`registerWithLeader(Leader.FOLLOWERINFO);`方法：

```java
protected long registerWithLeader(int pktType) throws IOException {
	long lastLoggedZxid = self.getLastLoggedZxid();
	QuorumPacket qp = new QuorumPacket();
	qp.setType(pktType);
	qp.setZxid(ZxidUtils.makeZxid(self.getAcceptedEpoch(), 0));
	LearnerInfo li = new LearnerInfo(self.getId(), 0x10000, self.getQuorumVerifier().getVersion());
	ByteArrayOutputStream bsid = new ByteArrayOutputStream();
	BinaryOutputArchive boa = BinaryOutputArchive.getArchive(bsid);
	boa.writeRecord(li, "LearnerInfo");
	qp.setData(bsid.toByteArray());
    
	writePacket(qp, true); // 将自己的epoch和Zxid发送给Leader
    
	readPacket(qp); // 然后等来Leader的回应消息
	final long newEpoch = ZxidUtils.getEpochFromZxid(qp.getZxid()); // 得到回应消息
	if (qp.getType() == Leader.LEADERINFO) {
		leaderProtocolVersion = ByteBuffer.wrap(qp.getData()).getInt();
		byte[] epochBytes = new byte[4];
		final ByteBuffer wrappedEpochBytes = ByteBuffer.wrap(epochBytes);
		if (newEpoch > self.getAcceptedEpoch()) {
			wrappedEpochBytes.putInt((int) self.getCurrentEpoch());
			self.setAcceptedEpoch(newEpoch);
		} else if (newEpoch == self.getAcceptedEpoch()) {
			wrappedEpochBytes.putInt(-1);
		} else {
			throw new IOException("Leaders epoch, "
								  + newEpoch
								  + " is less than accepted epoch, "
								  + self.getAcceptedEpoch());
		}
        // 回复leader已经收到leader的epoch和Zxid
		QuorumPacket ackNewEpoch = new QuorumPacket(Leader.ACKEPOCH, lastLoggedZxid, epochBytes, null);
		writePacket(ackNewEpoch, true);
		return ZxidUtils.makeZxid(newEpoch, 0);
	} else {
		if (newEpoch > self.getAcceptedEpoch()) {
			self.setAcceptedEpoch(newEpoch);
		}
		if (qp.getType() != Leader.NEWLEADER) {
			LOG.error("First packet should have been NEWLEADER");
			throw new IOException("First packet should have been NEWLEADER");
		}
		return qp.getZxid();
	}
}
```

处理 packet 信息，处理提案信息跟进`processPacket(qp); `方法：

```java
protected void processPacket(QuorumPacket qp) throws Exception {
	switch (qp.getType()) {
	case Leader.PING:
		ping(qp);
		break;
	case Leader.PROPOSAL:
		ServerMetrics.getMetrics().LEARNER_PROPOSAL_RECEIVED_COUNT.add(1);
		TxnLogEntry logEntry = SerializeUtils.deserializeTxn(qp.getData());
		TxnHeader hdr = logEntry.getHeader();
		Record txn = logEntry.getTxn();
		TxnDigest digest = logEntry.getDigest();
		if (hdr.getZxid() != lastQueued + 1) {
			LOG.warn(
				"Got zxid 0x{} expected 0x{}",
				Long.toHexString(hdr.getZxid()),
				Long.toHexString(lastQueued + 1));
		}
		lastQueued = hdr.getZxid();

		if (hdr.getType() == OpCode.reconfig) {
			SetDataTxn setDataTxn = (SetDataTxn) txn;
			QuorumVerifier qv = self.configFromString(new String(setDataTxn.getData(), UTF_8));
			self.setLastSeenQuorumVerifier(qv, true);
		}

		fzk.logRequest(hdr, txn, digest);
		if (hdr != null) {
			/*
			 * Request header is created only by the leader, so this is only set
			 * for quorum packets. If there is a clock drift, the latency may be
			 * negative. Headers use wall time, not CLOCK_MONOTONIC.
			 */
			long now = Time.currentWallTime();
			long latency = now - hdr.getTime();
			if (latency >= 0) {
				ServerMetrics.getMetrics().PROPOSAL_LATENCY.add(latency);
			}
		}
		if (om != null) {
			final long startTime = Time.currentElapsedTime();
			om.proposalReceived(qp);
			ServerMetrics.getMetrics().OM_PROPOSAL_PROCESS_TIME.add(Time.currentElapsedTime() - startTime);
		}
		break;
	case Leader.COMMIT:
        // 处理提案
		ServerMetrics.getMetrics().LEARNER_COMMIT_RECEIVED_COUNT.add(1);
		fzk.commit(qp.getZxid());
		if (om != null) {
			final long startTime = Time.currentElapsedTime();
			om.proposalCommitted(qp.getZxid());
			ServerMetrics.getMetrics().OM_COMMIT_PROCESS_TIME.add(Time.currentElapsedTime() - startTime);
		}
		break;

	case Leader.COMMITANDACTIVATE:
		// get the new configuration from the request
		Request request = fzk.pendingTxns.element();
		SetDataTxn setDataTxn = (SetDataTxn) request.getTxn();
		QuorumVerifier qv = self.configFromString(new String(setDataTxn.getData(), UTF_8));

		// get new designated leader from (current) leader's message
		ByteBuffer buffer = ByteBuffer.wrap(qp.getData());
		long suggestedLeaderId = buffer.getLong();
		final long zxid = qp.getZxid();
		boolean majorChange = self.processReconfig(qv, suggestedLeaderId, zxid, true);
		// commit (writes the new config to ZK tree (/zookeeper/config)
		fzk.commit(zxid);

		if (om != null) {
			om.informAndActivate(zxid, suggestedLeaderId);
		}
		if (majorChange) {
			throw new Exception("changes proposed in reconfig");
		}
		break;
	case Leader.UPTODATE:
		LOG.error("Received an UPTODATE message after Follower started");
		break;
	case Leader.REVALIDATE:
		if (om == null || !om.revalidateLearnerSession(qp)) {
			revalidate(qp);
		}
		break;
	case Leader.SYNC:
		fzk.sync();
		break;
	default:
		LOG.warn("Unknown packet type: {}", LearnerHandler.packetToString(qp));
		break;
	}
}
```

跟进`fzk.commit(qp.getZxid());`方法:

```java
public void commit(long zxid) {
	if (pendingTxns.size() == 0) {
		LOG.warn("Committing " + Long.toHexString(zxid) + " without seeing txn");
		return;
	}
	long firstElementZxid = pendingTxns.element().zxid;
	if (firstElementZxid != zxid) {
		LOG.error("Committing zxid 0x" + Long.toHexString(zxid)
				  + " but next pending txn 0x" + Long.toHexString(firstElementZxid));
		ServiceUtils.requestSystemExit(ExitCode.UNMATCHED_TXN_COMMIT.getValue());
	}
	Request request = pendingTxns.remove();
	request.logLatency(ServerMetrics.getMetrics().COMMIT_PROPAGATION_LATENCY);
	commitProcessor.commit(request);
}
```

