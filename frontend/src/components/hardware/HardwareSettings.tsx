import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './hardware-settings.module.css';
import { useAuraHardware } from '@/hooks/useAuraHardware';
import { createPrinterId } from '@/lib/hardware/printer-config';

export function HardwareSettings() {
  const { t } = useTranslation();
  const {
    loading,
    isAndroid,
    config,
    permissionsGranted,
    bluetoothEnabled,
    scannedPrinters,
    posApps,
    message,
    error,
    requestPermissions,
    scanPrinters,
    savePrinter,
    deletePrinter,
    markDefaultPrinter,
    testPrinter,
    testConnection,
    loadPosApps,
    savePos,
    openBluetoothSettings,
  } = useAuraHardware();

  const [printerLabel, setPrinterLabel] = useState(t('settings.hardwareDefaultPrinterName'));
  const [printerType, setPrinterType] = useState<'bluetooth' | 'wifi'>('bluetooth');
  const [printerAddress, setPrinterAddress] = useState('');
  const [selectedScan, setSelectedScan] = useState('');
  const [posQuery, setPosQuery] = useState('');
  const [posPackage, setPosPackage] = useState('');
  const [posLabel, setPosLabel] = useState('');
  const [deepLinkTemplate, setDeepLinkTemplate] = useState('');

  useEffect(() => {
    if (isAndroid) loadPosApps('');
  }, [isAndroid, loadPosApps]);

  useEffect(() => {
    if (config.pos) {
      setPosPackage(config.pos.packageName);
      setPosLabel(config.pos.label);
      setDeepLinkTemplate(config.pos.deepLinkTemplate ?? '');
    }
  }, [config.pos]);

  if (loading) {
    return <div className={styles.hw}>{t('settings.hardwareLoading')}</div>;
  }

  if (!isAndroid) {
    return (
      <div className={styles.hw}>
        <div className={`${styles.banner} ${styles.bannerWarn}`}>
          <strong>{t('settings.hardwareBrowserMode')}</strong>
          <p className={styles.sectionHint}>{t('settings.hardwareBrowserHint')}</p>
        </div>
      </div>
    );
  }

  async function handleSavePrinter() {
    const address =
      printerType === 'bluetooth' && selectedScan
        ? selectedScan
        : printerAddress.trim();

    if (!address) return;

    await savePrinter(
      {
        id: createPrinterId(printerLabel),
        label: printerLabel.trim() || t('settings.hardwareDefaultPrinterName'),
        type: printerType,
        address,
      },
      config.printers.length === 0,
    );
  }

  async function handleSavePos() {
    if (!posPackage.trim()) return;
    await savePos({
      packageName: posPackage.trim(),
      label: posLabel.trim() || posPackage.trim(),
      deepLinkTemplate: deepLinkTemplate.trim() || undefined,
    });
  }

  return (
    <div className={styles.hw}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('settings.hardwarePageTitle')}</h1>
        <p className={styles.subtitle}>{t('settings.hardwarePageSubtitle')}</p>
      </header>

      {message && (
        <div className={`${styles.banner} ${styles.bannerOk}`}>{message}</div>
      )}
      {error && (
        <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('settings.hardwarePermissionsTitle')}</h2>
        <p className={styles.sectionHint}>{t('settings.hardwarePermissionsHint')}</p>
        <div className={styles.row}>
          <button type="button" className={styles.btn} onClick={() => requestPermissions()}>
            {t('settings.hardwareRequestPermissions')}
          </button>
          <button type="button" className={styles.btn} onClick={() => openBluetoothSettings()}>
            {t('settings.hardwareBluetoothSettings')}
          </button>
          <span className={styles.chip}>
            {t('settings.hardwarePermissionsStatus', {
              status: permissionsGranted
                ? t('settings.hardwareStatusOk')
                : t('settings.hardwareStatusMissing'),
            })}
          </span>
          <span className={styles.chip}>
            {t('settings.hardwareBluetoothStatus', {
              status: bluetoothEnabled
                ? t('settings.hardwareStatusOn')
                : t('settings.hardwareStatusOff'),
            })}
          </span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('settings.hardwarePrintersTitle')}</h2>
        <p className={styles.sectionHint}>{t('settings.hardwarePrintersHint')}</p>

        <div className={styles.row}>
          <button type="button" className={styles.btn} onClick={() => scanPrinters()}>
            {t('settings.hardwareScanBluetooth')}
          </button>
        </div>

        {scannedPrinters.length > 0 && (
          <div className={styles.chips} style={{ marginBottom: 12 }}>
            {scannedPrinters.map((item) => (
              <button
                key={item.address}
                type="button"
                className={`${styles.chip} ${selectedScan === item.address ? styles.chipActive : ''}`}
                onClick={() => {
                  setSelectedScan(item.address);
                  setPrinterType('bluetooth');
                  setPrinterAddress(item.address);
                  if (!printerLabel || printerLabel === t('settings.hardwareDefaultPrinterName')) {
                    setPrinterLabel(item.name);
                  }
                }}
              >
                {item.name} ({item.address})
              </button>
            ))}
          </div>
        )}

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>{t('settings.hardwarePrinterName')}</span>
            <input
              className={styles.input}
              value={printerLabel}
              onChange={(e) => setPrinterLabel(e.target.value)}
              placeholder={t('settings.hardwarePrinterNamePlaceholder')}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t('settings.hardwarePrinterType')}</span>
            <select
              className={styles.select}
              value={printerType}
              onChange={(e) => setPrinterType(e.target.value as 'bluetooth' | 'wifi')}
            >
              <option value="bluetooth">{t('settings.hardwarePrinterBluetooth')}</option>
              <option value="wifi">{t('settings.hardwarePrinterWifi')}</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t('settings.hardwarePrinterAddress')}</span>
            <input
              className={styles.input}
              value={printerAddress}
              onChange={(e) => setPrinterAddress(e.target.value)}
              placeholder={printerType === 'wifi'
                ? t('settings.hardwarePrinterAddressWifi')
                : t('settings.hardwarePrinterAddressBt')}
            />
          </label>
        </div>

        <div className={styles.row}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSavePrinter}>
            {t('settings.hardwareSavePrinter')}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() =>
              testConnection(printerType, printerAddress.trim(), printerLabel.trim())
            }
          >
            {t('settings.hardwareTestConnection')}
          </button>
        </div>

        <div className={styles.list} style={{ marginTop: 16 }}>
          {config.printers.length === 0 && (
            <p className={styles.empty}>{t('settings.hardwareNoPrinters')}</p>
          )}
          {config.printers.map((printer) => (
            <article key={printer.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h3 className={styles.cardTitle}>
                    {printer.label}
                    {config.defaultPrinterId === printer.id
                      ? ` · ${t('settings.hardwareDefaultBadge')}`
                      : ''}
                  </h3>
                  <p className={styles.cardMeta}>
                    {printer.type} — {printer.address}
                  </p>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button type="button" className={styles.btn} onClick={() => testPrinter(printer.id)}>
                  {t('settings.hardwareTestPrint')}
                </button>
                <button type="button" className={styles.btn} onClick={() => markDefaultPrinter(printer.id)}>
                  {t('settings.hardwareSetDefault')}
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => deletePrinter(printer.id)}
                >
                  {t('settings.hardwareDelete')}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('settings.hardwarePosTitle')}</h2>
        <p className={styles.sectionHint}>{t('settings.hardwarePosHint')}</p>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>{t('settings.hardwareSearchApps')}</span>
            <input
              className={styles.input}
              value={posQuery}
              onChange={(e) => setPosQuery(e.target.value)}
              placeholder={t('settings.hardwareSearchAppsPlaceholder')}
            />
          </label>
          <button type="button" className={styles.btn} onClick={() => loadPosApps(posQuery)}>
            {t('settings.hardwareSearch')}
          </button>
        </div>

        {posApps.length > 0 && (
          <div className={styles.chips} style={{ marginBottom: 12 }}>
            {posApps.slice(0, 24).map((app) => (
              <button
                key={app.packageName}
                type="button"
                className={`${styles.chip} ${posPackage === app.packageName ? styles.chipActive : ''}`}
                onClick={() => {
                  setPosPackage(app.packageName);
                  setPosLabel(app.label);
                }}
              >
                {app.label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>{t('settings.hardwarePackageName')}</span>
            <input
              className={styles.input}
              value={posPackage}
              onChange={(e) => setPosPackage(e.target.value)}
              placeholder={t('settings.hardwarePackageNamePlaceholder')}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t('settings.hardwarePosLabel')}</span>
            <input
              className={styles.input}
              value={posLabel}
              onChange={(e) => setPosLabel(e.target.value)}
              placeholder={t('settings.hardwarePosLabelPlaceholder')}
            />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>{t('settings.hardwareDeepLink')}</span>
          <textarea
            className={styles.textarea}
            value={deepLinkTemplate}
            onChange={(e) => setDeepLinkTemplate(e.target.value)}
            placeholder={t('settings.hardwareDeepLinkPlaceholder')}
          />
        </label>

        <div className={styles.row}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSavePos}>
            {t('settings.hardwareSavePos')}
          </button>
          <button type="button" className={styles.btn} onClick={() => savePos(null)}>
            {t('settings.hardwareRemovePos')}
          </button>
        </div>
      </section>
    </div>
  );
}
