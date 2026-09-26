import os from "node:os";

export type ServerInfo = { ips: string[]; port: number; urls: string[] };

/** LAN上の（内部でない）IPv4アドレスと、各端末で開くURL */
export function getServerInfo(port = Number(process.env.PORT ?? 3000)): ServerInfo {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((a): a is os.NetworkInterfaceInfo => !!a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);
  return { ips, port, urls: ips.map((ip) => `http://${ip}:${port}`) };
}
