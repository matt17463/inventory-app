"""Private Tailscale-only TCP relay to the business Mac's Screen Sharing.

No application data is inspected, stored, or logged. macOS still authenticates
every Screen Sharing session. Addresses are deliberately fixed, not supplied
by an HTTP request or client-controlled forwarding parameter.
"""
import asyncio

LISTEN_HOST = '100.117.18.123'
LISTEN_PORT = 15900
MAC_HOST = '192.168.1.155'
MAC_PORT = 5900
active = 0

async def copy_stream(reader, writer):
    try:
        while data := await reader.read(65536):
            writer.write(data)
            await writer.drain()
    except (OSError, ConnectionError):
        pass

async def handle(reader, writer):
    global active
    if active >= 16:
        writer.close()
        await writer.wait_closed()
        return
    active += 1
    remote_writer = None
    tasks = []
    try:
        remote_reader, remote_writer = await asyncio.wait_for(asyncio.open_connection(MAC_HOST, MAC_PORT), 5)
        tasks = [asyncio.create_task(copy_stream(reader, remote_writer)), asyncio.create_task(copy_stream(remote_reader, writer))]
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    except (OSError, TimeoutError, ConnectionError):
        pass
    finally:
        for task in tasks: task.cancel()
        if tasks: await asyncio.gather(*tasks, return_exceptions=True)
        for stream in [remote_writer, writer]:
            if stream:
                stream.close()
                try: await stream.wait_closed()
                except (OSError, ConnectionError): pass
        active -= 1

async def main():
    server = await asyncio.start_server(handle, LISTEN_HOST, LISTEN_PORT, backlog=16)
    async with server: await server.serve_forever()

if __name__ == '__main__': asyncio.run(main())
