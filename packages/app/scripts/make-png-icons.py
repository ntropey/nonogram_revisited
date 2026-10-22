import zlib
import struct
import math

def make_png(width, height, get_pixel):
    # RGBA
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # filter type 0 (None)
        for x in range(width):
            r, g, b, a = get_pixel(x, y)
            raw_data.extend([r, g, b, a])
    
    compressed = zlib.compress(raw_data, 9)
    
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(chunk(b'IHDR', ihdr))
    png.extend(chunk(b'IDAT', compressed))
    png.extend(chunk(b'IEND', b''))
    return png

def render_nonogram_icon(size, rounded=True):
    # Palette
    c_bg = (11, 18, 32, 255)       # #0b1220
    c_board = (22, 32, 51, 255)    # #162033
    c_filled = (61, 198, 242, 255) # #3dc6f2
    c_empty = (28, 41, 64, 255)    # #1c2940
    c_cross = (122, 138, 165, 255) # #7a8aa5

    # 5x5 pattern: Heart / Diamond Picross
    pattern = [
        [0, 1, 1, 1, 0],
        [1, 1, 2, 1, 1], # 2 is cross
        [1, 1, 1, 1, 1],
        [0, 1, 1, 1, 0],
        [0, 0, 1, 0, 0],
    ]

    scale = size / 512.0
    rx = 96 * scale if rounded else 0

    def get_pixel(x, y):
        # Outer corner rounding
        if rounded and rx > 0:
            dx = min(x, size - 1 - x)
            dy = min(y, size - 1 - y)
            if dx < rx and dy < rx:
                dist = math.hypot(rx - dx, rx - dy)
                if dist > rx:
                    return (0, 0, 0, 0)

        # Board bounds
        bx1, by1 = 76 * scale, 76 * scale
        bx2, by2 = 436 * scale, 436 * scale

        if bx1 <= x <= bx2 and by1 <= y <= by2:
            # Check cells
            cell_size = 60 * scale
            gap = 10 * scale
            start_x = 86 * scale
            start_y = 104 * scale
            
            for row in range(5):
                for col in range(5):
                    cx1 = start_x + col * (cell_size + gap)
                    cy1 = start_y + row * (cell_size + gap)
                    cx2 = cx1 + cell_size
                    cy2 = cy1 + cell_size

                    if cx1 <= x <= cx2 and cy1 <= y <= cy2:
                        val = pattern[row][col]
                        if val == 1:
                            return c_filled
                        elif val == 2:
                            # Cross
                            rel_x = (x - cx1) / cell_size
                            rel_y = (y - cy1) / cell_size
                            if abs(rel_x - rel_y) < 0.12 or abs(rel_x - (1 - rel_y)) < 0.12:
                                return c_cross
                            return c_empty
                        else:
                            return c_board

            return c_board
        
        return c_bg

    return make_png(size, size, get_pixel)

if __name__ == '__main__':
    with open('packages/app/public/icon-192.png', 'wb') as f:
        f.write(render_nonogram_icon(192, rounded=True))
    with open('packages/app/public/icon-512.png', 'wb') as f:
        f.write(render_nonogram_icon(512, rounded=True))
    with open('packages/app/public/apple-touch-icon.png', 'wb') as f:
        f.write(render_nonogram_icon(180, rounded=False))
    with open('packages/app/public/icon-maskable-512.png', 'wb') as f:
        f.write(render_nonogram_icon(512, rounded=False))
    print("PNG icons generated successfully.")
