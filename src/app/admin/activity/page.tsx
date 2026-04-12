import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export default async function ActivityPage() {
  let logs: (Awaited<ReturnType<typeof prisma.activityLog.findMany>>[number] & {
    merchant?: { name: string } | null;
  })[] = [];

  try {
    logs = await prisma.activityLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: {
        merchant: { select: { name: true } },
      },
    });
  } catch (err) {
    console.error("Activity page error:", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-gray-500 mt-1">Audit trail of all system activity</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="divide-y divide-gray-100">
          {logs.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              No activity recorded yet
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="px-6 py-4 flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {log.action}
                    </span>
                    <span className="text-sm text-gray-400">on</span>
                    <span className="text-sm text-gray-600">{log.entity}</span>
                    {log.merchant && (
                      <>
                        <span className="text-sm text-gray-400">·</span>
                        <span className="text-sm text-gray-500">
                          {log.merchant.name}
                        </span>
                      </>
                    )}
                  </div>
                  {log.details && (
                    <p className="text-sm text-gray-400 mt-1 truncate">
                      {log.details}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
