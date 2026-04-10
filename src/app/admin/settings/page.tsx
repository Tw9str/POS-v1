export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-500 mt-1">Platform-wide configuration</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Basic", price: "50,000 SYP/mo", features: ["1 staff", "100 products", "Basic reports"] },
              { name: "Standard", price: "100,000 SYP/mo", features: ["5 staff", "Unlimited products", "Full reports", "Customer management"] },
              { name: "Premium", price: "200,000 SYP/mo", features: ["Unlimited staff", "Unlimited products", "Advanced analytics", "Priority support", "Multi-device"] },
            ].map((plan) => (
              <div key={plan.name} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                <p className="text-lg font-bold text-blue-600 mt-1">{plan.price}</p>
                <ul className="mt-3 space-y-1">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm text-gray-500 flex items-center gap-2">
                      <span className="text-green-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">License Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Default license duration</p>
              <p className="text-lg font-medium text-gray-900">30 days</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Grace period</p>
              <p className="text-lg font-medium text-gray-900">7 days</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
