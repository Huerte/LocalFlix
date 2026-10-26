package com.sarge.localflix

import android.content.Context
import android.net.wifi.WifiManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.SocketTimeoutException
import kotlin.coroutines.coroutineContext

/** A LocalFlix server that answered the discovery broadcast. */
data class FoundServer(val url: String, val name: String)

/**
 * Finds the laptop automatically.
 *
 * The server (lf/server.py, start_discovery) listens on UDP port 50505. We broadcast the text
 * LOCALFLIX_DISCOVER and it answers the sender with {"app":"LocalFlix","port":8080,"name":"<pc>"}.
 * The server's address is simply the address the answer came from.
 */
object Discovery {
    private const val PORT = 50505
    private const val MESSAGE = "LOCALFLIX_DISCOVER"
    private const val TOTAL_MS = 2500L      // how long we wait for an answer
    private const val RESEND_MS = 700L      // UDP can be lost, so ask again a few times

    suspend fun find(context: Context): FoundServer? = withContext(Dispatchers.IO) {
        // Many Android TVs drop broadcast/multicast packets unless an app holds this lock.
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        val lock = try {
            wifi?.createMulticastLock("localflix-discovery")?.apply { setReferenceCounted(false); acquire() }
        } catch (e: Exception) {
            null
        }
        try {
            DatagramSocket().use { socket ->
                socket.broadcast = true
                socket.soTimeout = 300
                val targets = broadcastTargets()
                val data = MESSAGE.toByteArray()
                val buf = ByteArray(512)
                val end = System.currentTimeMillis() + TOTAL_MS
                var lastSend = 0L
                while (System.currentTimeMillis() < end) {
                    coroutineContext.ensureActive()        // stop quickly when the user presses Retry/Back
                    val now = System.currentTimeMillis()
                    if (now - lastSend >= RESEND_MS) {
                        lastSend = now
                        for (t in targets) {
                            try { socket.send(DatagramPacket(data, data.size, t, PORT)) } catch (e: Exception) { /* try the next one */ }
                        }
                    }
                    try {
                        val p = DatagramPacket(buf, buf.size)
                        socket.receive(p)
                        val json = JSONObject(String(p.data, 0, p.length))
                        if (json.optString("app") == "LocalFlix") {
                            val port = json.optInt("port", 8080)
                            return@withContext FoundServer("http://${p.address.hostAddress}:$port", json.optString("name"))
                        }
                    } catch (e: SocketTimeoutException) {
                        // nothing yet, loop again
                    } catch (e: Exception) {
                        // not our JSON, ignore
                    }
                }
            }
            null
        } catch (e: Exception) {
            null
        } finally {
            try { lock?.release() } catch (e: Exception) { /* already released */ }
        }
    }

    /** 255.255.255.255 plus the directed broadcast address of every active IPv4 network (Wi-Fi or Ethernet). */
    private fun broadcastTargets(): List<InetAddress> {
        val out = LinkedHashSet<InetAddress>()
        try {
            out.add(InetAddress.getByName("255.255.255.255"))
            for (nic in NetworkInterface.getNetworkInterfaces()) {
                if (!nic.isUp || nic.isLoopback) continue
                for (ia in nic.interfaceAddresses) {
                    val b = ia.broadcast
                    if (b is Inet4Address) out.add(b)
                }
            }
        } catch (e: Exception) {
            // keep whatever we have
        }
        return out.toList()
    }
}
