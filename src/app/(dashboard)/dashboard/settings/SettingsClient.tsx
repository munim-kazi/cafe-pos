"use client";

import { useState, useCallback } from "react";

interface CafeSettings {
  cafeName: string;
  cafeAddress: string;
  cafePhone: string;
  cafeEmail: string;
  taxRegistrationNumber: string;
  openTime: string;
  closeTime: string;
  currency: string;
  defaultTaxRate: number;
  taxInclusive: boolean;
  receiptFooter: string;
  showLogo: boolean;
  showTaxBreakdown: boolean;
}

const DEFAULT_SETTINGS: CafeSettings = {
  cafeName: "",
  cafeAddress: "",
  cafePhone: "",
  cafeEmail: "",
  taxRegistrationNumber: "",
  openTime: "09:00",
  closeTime: "22:00",
  currency: "BDT",
  defaultTaxRate: 0,
  taxInclusive: false,
  receiptFooter: "Thank you for visiting!",
  showLogo: true,
  showTaxBreakdown: true,
};

const STORAGE_KEY = "cafe-pos-settings";

interface Toast {
  message: string;
  type: "success" | "error";
}

export default function SettingsClient() {
  const [settings, setSettings] = useState<CafeSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // ignore malformed data
    }
    return DEFAULT_SETTINGS;
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      showToast("Settings saved successfully", "success");
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof CafeSettings>(
    key: K,
    value: CafeSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const inputClass =
    "block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  const labelClass = "block text-sm font-medium text-gray-700";

  const sectionClass =
    "rounded-lg border border-gray-200 bg-white p-6";

  const toastClass =
    "fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg " +
    (toast?.type === "success" ? "bg-green-600" : "bg-red-600");

  return (
    <div>
      {toast && <div className={toastClass}>{toast.message}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure your cafe information, operating hours and receipt preferences.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="mt-6 space-y-6">
        {/* Business Info */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">
            Business Information
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Basic information about your cafe or business.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cafe-name" className={labelClass}>
                Cafe Name
              </label>
              <input
                id="cafe-name"
                type="text"
                value={settings.cafeName}
                onChange={(e) => update("cafeName", e.target.value)}
                className={inputClass}
                placeholder="e.g. Coffee House"
              />
            </div>
            <div>
              <label htmlFor="cafe-phone" className={labelClass}>
                Phone
              </label>
              <input
                id="cafe-phone"
                type="text"
                value={settings.cafePhone}
                onChange={(e) => update("cafePhone", e.target.value)}
                className={inputClass}
                placeholder="+880 1XXXXXXXXX"
              />
            </div>
            <div>
              <label htmlFor="cafe-email" className={labelClass}>
                Email
              </label>
              <input
                id="cafe-email"
                type="email"
                value={settings.cafeEmail}
                onChange={(e) => update("cafeEmail", e.target.value)}
                className={inputClass}
                placeholder="info@cafe.com"
              />
            </div>
            <div>
              <label htmlFor="tax-reg" className={labelClass}>
                Tax Registration Number
              </label>
              <input
                id="tax-reg"
                type="text"
                value={settings.taxRegistrationNumber}
                onChange={(e) =>
                  update("taxRegistrationNumber", e.target.value)
                }
                className={inputClass}
                placeholder="e.g. 1234567890"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cafe-address" className={labelClass}>
                Address
              </label>
              <textarea
                id="cafe-address"
                rows={2}
                value={settings.cafeAddress}
                onChange={(e) => update("cafeAddress", e.target.value)}
                className={inputClass}
                placeholder="Full business address"
              />
            </div>
          </div>
        </div>

        {/* Operating Hours */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">
            Operating Hours
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Set your standard opening and closing times. These are display-only
            for now and are not enforced.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="open-time" className={labelClass}>
                Opening Time
              </label>
              <input
                id="open-time"
                type="time"
                value={settings.openTime}
                onChange={(e) => update("openTime", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="close-time" className={labelClass}>
                Closing Time
              </label>
              <input
                id="close-time"
                type="time"
                value={settings.closeTime}
                onChange={(e) => update("closeTime", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Currency */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">Currency</h2>
          <p className="mt-1 text-sm text-gray-500">
            Currency display is fixed for the Bangladesh market.
          </p>
          <div className="mt-4">
            <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-lg font-bold text-gray-900">{"\u09F3"}</span>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Bangladeshi Taka (BDT)
                </p>
                <p className="text-xs text-gray-500">
                  Currency is read-only for this market
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tax Settings */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">Tax Settings</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure default tax rates for your orders.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tax-rate" className={labelClass}>
                Default Tax Rate (%)
              </label>
              <input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={settings.defaultTaxRate}
                onChange={(e) =>
                  update("defaultTaxRate", parseFloat(e.target.value) || 0)
                }
                className={inputClass}
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.taxInclusive}
                  onClick={() => update("taxInclusive", !settings.taxInclusive)}
                  className={
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 " +
                    (settings.taxInclusive ? "bg-indigo-600" : "bg-gray-200")
                  }
                >
                  <span
                    className={
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out " +
                      (settings.taxInclusive
                        ? "translate-x-5"
                        : "translate-x-0")
                    }
                  />
                </button>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {settings.taxInclusive ? "Tax Inclusive" : "Tax Exclusive"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {settings.taxInclusive
                      ? "Tax is included in item prices"
                      : "Tax is added on top of item prices"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Receipt Settings */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">
            Receipt Settings
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Customize what appears on printed or digital receipts.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="receipt-footer" className={labelClass}>
                Footer Message
              </label>
              <input
                id="receipt-footer"
                type="text"
                value={settings.receiptFooter}
                onChange={(e) => update("receiptFooter", e.target.value)}
                className={inputClass}
                placeholder="e.g. Thank you for visiting!"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showLogo}
                  onClick={() => update("showLogo", !settings.showLogo)}
                  className={
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 " +
                    (settings.showLogo ? "bg-indigo-600" : "bg-gray-200")
                  }
                >
                  <span
                    className={
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out " +
                      (settings.showLogo ? "translate-x-5" : "translate-x-0")
                    }
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  Show Logo
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showTaxBreakdown}
                  onClick={() =>
                    update("showTaxBreakdown", !settings.showTaxBreakdown)
                  }
                  className={
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 " +
                    (settings.showTaxBreakdown
                      ? "bg-indigo-600"
                      : "bg-gray-200")
                  }
                >
                  <span
                    className={
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out " +
                      (settings.showTaxBreakdown
                        ? "translate-x-5"
                        : "translate-x-0")
                    }
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  Show Tax Breakdown
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom save bar */}
      <div className="sticky bottom-0 mt-6 flex justify-end border-t border-gray-200 bg-gray-50 py-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
