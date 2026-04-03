from __future__ import annotations

import math
import textwrap

from manim import *


HAND_FONT = "Chalkboard SE"
UI_FONT = "Avenir Next"

PALETTES = {
    "default": {
        "background": "#f7f2e7",
        "background_wash": "#efe7d8",
        "paper": "#f7f2e7",
        "bg": "#f7f2e7",
        "ink": "#1f1916",
        "muted": "#6b635b",
        "muted_ink": "#6b635b",
        "blue": "#d9e6fb",
        "soft_blue": "#d9e6fb",
        "green": "#d8efda",
        "mint": "#d8efda",
        "soft_green": "#d8efda",
        "purple": "#eadcf7",
        "lilac": "#eadcf7",
        "soft_purple": "#eadcf7",
        "amber": "#f7e7c6",
        "orange": "#f7e7c6",
        "soft_amber": "#f7e7c6",
        "cream": "#fff9ef",
        "panel": "#fff9ef",
        "panel_bg": "#fff9ef",
        "highlight": "#d9e6fb",
    },
    "blue": {
        "background": "#f4f4f0",
        "background_wash": "#ebebe5",
        "paper": "#f4f4f0",
        "bg": "#f4f4f0",
        "ink": "#1f1916",
        "muted": "#5f5c57",
        "muted_ink": "#5f5c57",
        "blue": "#d9e7fb",
        "soft_blue": "#d9e7fb",
        "green": "#d7efe1",
        "mint": "#d7efe1",
        "soft_green": "#d7efe1",
        "purple": "#e5def8",
        "lilac": "#e5def8",
        "soft_purple": "#e5def8",
        "amber": "#f8ebc7",
        "orange": "#f8ebc7",
        "soft_amber": "#f8ebc7",
        "cream": "#fffaf2",
        "panel": "#fffaf2",
        "panel_bg": "#fffaf2",
        "highlight": "#d9e7fb",
    },
}


def _wrap_copy(value: str, width: int) -> str:
    return textwrap.fill(" ".join(value.strip().split()), width=width)


def infographic_palette(name: str | None = None) -> dict[str, str]:
    lowered = (name or "").lower()

    if "blue" in lowered or "cyan" in lowered or "mint" in lowered:
        return dict(PALETTES["blue"])

    return dict(PALETTES["default"])


def _tint_color(palette: dict[str, str], tint: str) -> str:
    normalized = (tint or "").strip().lower()
    return palette.get(normalized, palette["blue"])


def _ink(palette: dict[str, str]) -> str:
    return palette["ink"]


def _muted(palette: dict[str, str]) -> str:
    return palette["muted"]


def make_paper_background(palette: dict[str, str]) -> VGroup:
    width = config.frame_width
    height = config.frame_height

    paper = Rectangle(width=width, height=height)
    paper.set_fill(palette["background"], opacity=1)
    paper.set_stroke(width=0)

    blobs = VGroup(
        Ellipse(width=7.8, height=2.1)
        .set_fill(palette["background_wash"], opacity=0.45)
        .set_stroke(width=0)
        .move_to(DOWN * 2.6 + RIGHT * 3.2),
        Ellipse(width=6.8, height=1.6)
        .set_fill(WHITE, opacity=0.24)
        .set_stroke(width=0)
        .move_to(UP * 0.5 + LEFT * 2.9),
        Ellipse(width=5.8, height=1.3)
        .set_fill(palette["background_wash"], opacity=0.3)
        .set_stroke(width=0)
        .move_to(DOWN * 0.8 + LEFT * 4.5),
    )

    waves = VGroup()
    for index, y in enumerate([2.2, 1.35, 0.5, -0.35, -1.2, -2.05]):
        curve = VMobject()
        curve.set_points_smoothly(
            [
                LEFT * 7.1 + UP * y,
                LEFT * 3.6 + UP * (y + 0.22 - index * 0.01),
                RIGHT * 0.4 + UP * (y - 0.18 + index * 0.01),
                RIGHT * 3.9 + UP * (y + 0.16),
                RIGHT * 7.1 + UP * (y - 0.12),
            ]
        )
        curve.set_stroke(color=palette["background_wash"], opacity=0.28, width=3)
        waves.add(curve)

    return VGroup(paper, blobs, waves)


def make_section_badge(text: str, palette: dict[str, str]) -> VGroup:
    label = Text(
        text.upper(),
        font=UI_FONT,
        font_size=21,
        weight="MEDIUM",
        color=_ink(palette),
    )
    label.set_opacity(0.92)
    pill = RoundedRectangle(
        corner_radius=0.24,
        width=max(1.85, label.width + 0.62),
        height=0.64,
    )
    pill.set_fill(palette["cream"], opacity=1)
    pill.set_stroke(_ink(palette), width=2.5)
    label.move_to(pill.get_center())
    return VGroup(pill, label)


def make_title_block(
    headline: str, subhead: str, palette: dict[str, str], width: float = 11.8
) -> VGroup:
    headline_text = Text(
        _wrap_copy(headline, 24),
        font=HAND_FONT,
        font_size=42,
        weight="BOLD",
        color=_ink(palette),
    )
    subhead_text = Text(
        _wrap_copy(subhead, 44),
        font=UI_FONT,
        font_size=22,
        color=_muted(palette),
    )
    block = VGroup(headline_text, subhead_text)
    block.arrange(DOWN, aligned_edge=LEFT, buff=0.14)
    if block.width > width:
        block.scale_to_fit_width(width)
    return block


def make_footer_note(text: str, palette: dict[str, str], width: float = 11.5) -> VGroup:
    body = Text(
        _wrap_copy(text, 58),
        font=HAND_FONT,
        font_size=24,
        weight="MEDIUM",
        color=_ink(palette),
    )
    if body.width > width:
        body.scale_to_fit_width(width)
    return body


def _arrow_tip(color: str) -> Triangle:
    tip = Triangle()
    tip.scale(0.1)
    tip.set_fill(color, opacity=1)
    tip.set_stroke(color, width=0)
    return tip


def make_icon(name: str, color=BLACK, size: float = 0.5) -> VGroup:
    normalized = (name or "spark").strip().lower()

    if normalized == "query":
        bubble = Circle(radius=0.34, color=color, stroke_width=5)
        bubble.set_fill(opacity=0)
        mark = Text("?", font=UI_FONT, font_size=32, weight="BOLD", color=color)
        mark.move_to(bubble.get_center())
        icon = VGroup(bubble, mark)
    elif normalized == "document":
        page = RoundedRectangle(corner_radius=0.06, width=0.62, height=0.78)
        page.set_fill(opacity=0)
        page.set_stroke(color, width=5)
        fold = Line(page.get_top() + LEFT * 0.08, page.get_top() + RIGHT * 0.12)
        fold.set_stroke(color, width=4)
        lines = VGroup(
            Line(LEFT * 0.18, RIGHT * 0.18).set_stroke(color, width=3.5),
            Line(LEFT * 0.18, RIGHT * 0.12).set_stroke(color, width=3.5),
            Line(LEFT * 0.18, RIGHT * 0.15).set_stroke(color, width=3.5),
        ).arrange(DOWN, buff=0.1)
        lines.move_to(page.get_center() + DOWN * 0.08)
        icon = VGroup(page, fold, lines)
    elif normalized == "database":
        disks = VGroup()
        for offset in [0.2, 0.0, -0.2]:
            disk = RoundedRectangle(corner_radius=0.16, width=0.72, height=0.22)
            disk.set_fill(opacity=0)
            disk.set_stroke(color, width=5)
            disk.move_to(UP * offset)
            disks.add(disk)
        icon = disks
    elif normalized == "image":
        frame = RoundedRectangle(corner_radius=0.08, width=0.82, height=0.64)
        frame.set_fill(opacity=0)
        frame.set_stroke(color, width=5)
        sun = Dot(radius=0.05, color=color).move_to(frame.get_corner(UR) + LEFT * 0.18 + DOWN * 0.16)
        hill = VMobject()
        hill.set_points_as_corners(
            [
                frame.get_corner(DL) + RIGHT * 0.14 + UP * 0.12,
                frame.get_bottom() + LEFT * 0.02 + UP * 0.28,
                frame.get_bottom() + RIGHT * 0.18 + UP * 0.16,
                frame.get_corner(DR) + LEFT * 0.12 + UP * 0.12,
            ]
        )
        hill.set_stroke(color, width=4)
        icon = VGroup(frame, sun, hill)
    elif normalized == "audio":
        wave = VMobject()
        wave.set_points_smoothly(
            [
                LEFT * 0.34,
                LEFT * 0.18 + UP * 0.18,
                ORIGIN + DOWN * 0.2,
                RIGHT * 0.18 + UP * 0.18,
                RIGHT * 0.34,
            ]
        )
        wave.set_stroke(color, width=5)
        icon = VGroup(wave)
    elif normalized == "search":
        glass = Circle(radius=0.28, color=color, stroke_width=5)
        handle = Line(glass.get_corner(DR), glass.get_corner(DR) + RIGHT * 0.22 + DOWN * 0.22)
        handle.set_stroke(color, width=5)
        icon = VGroup(glass, handle)
    elif normalized == "gear":
        outer = Circle(radius=0.31, color=color, stroke_width=5)
        inner = Circle(radius=0.12, color=color, stroke_width=5)
        spokes = VGroup()
        for angle in [0, PI / 4, PI / 2, 3 * PI / 4]:
            spoke = Line(ORIGIN + RIGHT * 0.18, ORIGIN + RIGHT * 0.34)
            spoke.rotate(angle)
            spoke.set_stroke(color, width=5)
            spokes.add(spoke)
        icon = VGroup(outer, inner, spokes)
    elif normalized == "graph":
        points = [
            LEFT * 0.3 + DOWN * 0.12,
            LEFT * 0.06 + UP * 0.18,
            RIGHT * 0.22 + UP * 0.02,
            RIGHT * 0.34 + DOWN * 0.2,
        ]
        lines = VGroup(
            Line(points[0], points[1]),
            Line(points[1], points[2]),
            Line(points[2], points[3]),
            Line(points[0], points[2]),
        )
        lines.set_stroke(color, width=4)
        dots = VGroup(*[Dot(point=point, radius=0.055, color=color) for point in points])
        icon = VGroup(lines, dots)
    elif normalized == "check":
        ring = Circle(radius=0.34, color=color, stroke_width=5)
        tick = VMobject()
        tick.set_points_as_corners(
            [
                LEFT * 0.18,
                LEFT * 0.02 + DOWN * 0.14,
                RIGHT * 0.2 + UP * 0.16,
            ]
        )
        tick.set_stroke(color, width=5)
        icon = VGroup(ring, tick)
    elif normalized == "warning":
        triangle = Triangle()
        triangle.set_fill(opacity=0)
        triangle.set_stroke(color, width=5)
        mark = Text("!", font=UI_FONT, font_size=28, weight="BOLD", color=color)
        mark.move_to(triangle.get_center() + DOWN * 0.05)
        icon = VGroup(triangle, mark)
    elif normalized == "agent":
        head = Circle(radius=0.2, color=color, stroke_width=5)
        body = RoundedRectangle(corner_radius=0.1, width=0.48, height=0.34)
        body.set_fill(opacity=0)
        body.set_stroke(color, width=5)
        body.next_to(head, DOWN, buff=0.06)
        antenna = Line(head.get_top(), head.get_top() + UP * 0.12).set_stroke(color, width=4)
        antenna_dot = Dot(radius=0.04, color=color).next_to(antenna, UP, buff=0)
        icon = VGroup(head, body, antenna, antenna_dot)
    elif normalized == "memory":
        bars = VGroup(
            RoundedRectangle(corner_radius=0.06, width=0.74, height=0.18),
            RoundedRectangle(corner_radius=0.06, width=0.74, height=0.18),
            RoundedRectangle(corner_radius=0.06, width=0.74, height=0.18),
        ).arrange(DOWN, buff=0.1)
        for bar in bars:
            bar.set_fill(opacity=0)
            bar.set_stroke(color, width=4.5)
        icon = bars
    elif normalized == "server":
        rack = VGroup(
            RoundedRectangle(corner_radius=0.06, width=0.8, height=0.2),
            RoundedRectangle(corner_radius=0.06, width=0.8, height=0.2),
        ).arrange(DOWN, buff=0.12)
        for row in rack:
            row.set_fill(opacity=0)
            row.set_stroke(color, width=4.5)
        lights = VGroup(*[Dot(radius=0.025, color=color) for _ in range(4)]).arrange(RIGHT, buff=0.05)
        lights.move_to(rack.get_bottom() + UP * 0.12)
        icon = VGroup(rack, lights)
    elif normalized == "cloud":
        cloud = VGroup(
            Circle(radius=0.19),
            Circle(radius=0.24),
            Circle(radius=0.18),
            RoundedRectangle(corner_radius=0.18, width=0.72, height=0.26),
        )
        cloud[0].move_to(LEFT * 0.2)
        cloud[1].move_to(ORIGIN + UP * 0.08)
        cloud[2].move_to(RIGHT * 0.24)
        cloud[3].move_to(DOWN * 0.12)
        for shape in cloud:
            shape.set_fill(opacity=0)
            shape.set_stroke(color, width=4.5)
        icon = cloud
    elif normalized == "chart":
        bars = VGroup(
            Rectangle(width=0.14, height=0.28),
            Rectangle(width=0.14, height=0.44),
            Rectangle(width=0.14, height=0.6),
        ).arrange(RIGHT, buff=0.08, aligned_edge=DOWN)
        for bar in bars:
            bar.set_fill(opacity=0)
            bar.set_stroke(color, width=4.5)
        axis = VGroup(
            Line(LEFT * 0.3 + DOWN * 0.32, LEFT * 0.3 + UP * 0.34),
            Line(LEFT * 0.3 + DOWN * 0.32, RIGHT * 0.4 + DOWN * 0.32),
        )
        axis.set_stroke(color, width=4)
        icon = VGroup(axis, bars)
    elif normalized == "loop":
        left_arc = Arc(radius=0.34, start_angle=PI * 0.15, angle=PI * 1.35, color=color, stroke_width=5)
        right_arc = Arc(radius=0.22, start_angle=-PI * 0.85, angle=PI * 1.35, color=color, stroke_width=5)
        tip_a = _arrow_tip(color).rotate(-PI / 2).move_to(left_arc.point_from_proportion(1))
        tip_b = _arrow_tip(color).rotate(PI / 2).move_to(right_arc.point_from_proportion(1))
        icon = VGroup(left_arc, right_arc, tip_a, tip_b)
    elif normalized == "compare":
        left = RoundedRectangle(corner_radius=0.08, width=0.32, height=0.52)
        right = RoundedRectangle(corner_radius=0.08, width=0.32, height=0.52)
        left.set_fill(opacity=0)
        right.set_fill(opacity=0)
        left.set_stroke(color, width=4.5)
        right.set_stroke(color, width=4.5)
        left.shift(LEFT * 0.22)
        right.shift(RIGHT * 0.22)
        divider = Line(ORIGIN + UP * 0.3, ORIGIN + DOWN * 0.3).set_stroke(color, width=4)
        icon = VGroup(left, right, divider)
    elif normalized == "brain":
        lobes = VGroup(
            Circle(radius=0.18),
            Circle(radius=0.2),
            Circle(radius=0.17),
            Circle(radius=0.19),
        )
        offsets = [LEFT * 0.16 + UP * 0.06, RIGHT * 0.04 + UP * 0.08, LEFT * 0.06 + DOWN * 0.14, RIGHT * 0.2 + DOWN * 0.1]
        for lobe, offset in zip(lobes, offsets):
            lobe.move_to(offset)
            lobe.set_fill(opacity=0)
            lobe.set_stroke(color, width=4.5)
        stem = Line(DOWN * 0.26, DOWN * 0.4).set_stroke(color, width=4.5)
        icon = VGroup(lobes, stem)
    elif normalized == "flow":
        arrows = VGroup(
            Arrow(LEFT * 0.34, LEFT * 0.08, buff=0, stroke_width=5, color=color, max_stroke_width_to_length_ratio=10),
            Arrow(LEFT * 0.02, RIGHT * 0.24, buff=0, stroke_width=5, color=color, max_stroke_width_to_length_ratio=10),
            Arrow(RIGHT * 0.3 + DOWN * 0.08, RIGHT * 0.5 + DOWN * 0.08, buff=0, stroke_width=5, color=color, max_stroke_width_to_length_ratio=10),
        )
        icon = arrows
    else:
        burst = VGroup(
            Line(UP * 0.3, DOWN * 0.3),
            Line(LEFT * 0.3, RIGHT * 0.3),
            Line(UP * 0.22 + LEFT * 0.22, DOWN * 0.22 + RIGHT * 0.22),
            Line(UP * 0.22 + RIGHT * 0.22, DOWN * 0.22 + LEFT * 0.22),
        )
        burst.set_stroke(color, width=4.5)
        core = Dot(radius=0.03, color=color)
        icon = VGroup(burst, core)

    icon.scale_to_fit_height(size)
    return icon


def make_card(
    title: str,
    body: str,
    palette: dict[str, str],
    tint: str = "blue",
    width: float = 3.2,
    min_height: float = 1.7,
    icon: str = "spark",
    dashed: bool = False,
    eyebrow: str = "",
) -> VGroup:
    fill_color = _tint_color(palette, tint)
    rect = RoundedRectangle(corner_radius=0.18, width=width, height=min_height)
    rect.set_fill(fill_color, opacity=1)
    rect.set_stroke(_ink(palette), width=3)

    eyebrow_text = None
    if eyebrow.strip():
        eyebrow_text = Text(
            _wrap_copy(eyebrow, 18),
            font=UI_FONT,
            font_size=16,
            weight="MEDIUM",
            color=_muted(palette),
        )

    title_text = Text(
        _wrap_copy(title, 18 if width > 3.4 else 14),
        font=HAND_FONT,
        font_size=28,
        weight="BOLD",
        color=_ink(palette),
    )
    body_text = Text(
        _wrap_copy(body, 30 if width > 3.6 else 24),
        font=UI_FONT,
        font_size=20,
        color=_ink(palette),
        line_spacing=0.95,
    )

    icon_mark = make_icon(icon, color=_ink(palette), size=0.42)
    title_row = VGroup(title_text, icon_mark).arrange(RIGHT, buff=0.16, aligned_edge=UP)
    title_row[1].align_to(title_row[0], UP).shift(DOWN * 0.02)

    content_items = []
    if eyebrow_text is not None:
        content_items.append(eyebrow_text)
    content_items.extend([title_row, body_text])
    content = VGroup(*content_items).arrange(DOWN, aligned_edge=LEFT, buff=0.14)

    max_content_width = width - 0.52
    if content.width > max_content_width:
        content.scale_to_fit_width(max_content_width)

    needed_height = max(min_height, content.height + 0.52)
    rect.stretch_to_fit_height(needed_height)
    content.move_to(rect.get_center())
    content.align_to(rect.get_left() + RIGHT * 0.26, LEFT)

    parts = [rect]
    if dashed:
        border = DashedVMobject(rect.copy().set_fill(opacity=0), num_dashes=34)
        border.set_stroke(_ink(palette), width=2.5)
        parts.append(border)
    parts.append(content)
    card = VGroup(*parts)
    card.box = rect
    return card


def make_callout(
    title: str,
    body: str,
    palette: dict[str, str],
    tint: str = "cream",
    width: float = 2.8,
    icon: str = "spark",
) -> VGroup:
    rect = RoundedRectangle(corner_radius=0.16, width=width, height=1.4)
    rect.set_fill(_tint_color(palette, tint), opacity=1)
    rect.set_stroke(_ink(palette), width=0)
    dashed = DashedVMobject(rect.copy().set_fill(opacity=0), num_dashes=34)
    dashed.set_stroke(_ink(palette), width=2.5)

    title_text = Text(
        _wrap_copy(title, 16),
        font=HAND_FONT,
        font_size=24,
        weight="BOLD",
        color=_ink(palette),
    )
    body_text = Text(
        _wrap_copy(body, 24),
        font=UI_FONT,
        font_size=18,
        color=_ink(palette),
        line_spacing=0.95,
    )
    icon_mark = make_icon(icon, color=_ink(palette), size=0.38)
    head = VGroup(title_text, icon_mark).arrange(RIGHT, buff=0.14, aligned_edge=UP)
    content = VGroup(head, body_text).arrange(DOWN, aligned_edge=LEFT, buff=0.12)
    if content.width > width - 0.42:
        content.scale_to_fit_width(width - 0.42)
    rect.stretch_to_fit_height(max(1.45, content.height + 0.44))
    dashed.become(DashedVMobject(rect.copy().set_fill(opacity=0), num_dashes=36))
    dashed.set_stroke(_ink(palette), width=2.5)
    content.move_to(rect.get_center())
    content.align_to(rect.get_left() + RIGHT * 0.2, LEFT)
    callout = VGroup(rect, dashed, content)
    callout.box = rect
    return callout


def make_step_badge(value: str, palette: dict[str, str]) -> VGroup:
    ring = Circle(radius=0.19, color=_ink(palette), stroke_width=2.8)
    ring.set_fill(WHITE, opacity=0.9)
    label = Text(value, font=UI_FONT, font_size=20, weight="BOLD", color=_ink(palette))
    label.move_to(ring.get_center())
    badge = VGroup(ring, label)
    badge.box = ring
    return badge


def _resolve_box(mobject: Mobject) -> Mobject:
    return getattr(mobject, "box", mobject)


def _edge_points(source: Mobject, target: Mobject) -> tuple[np.ndarray, np.ndarray]:
    source_box = _resolve_box(source)
    target_box = _resolve_box(target)
    delta = target_box.get_center() - source_box.get_center()

    if abs(delta[0]) >= abs(delta[1]):
        if delta[0] >= 0:
            return source_box.get_right(), target_box.get_left()
        return source_box.get_left(), target_box.get_right()

    if delta[1] >= 0:
        return source_box.get_top(), target_box.get_bottom()
    return source_box.get_bottom(), target_box.get_top()


def connect_cards(
    source: Mobject,
    target: Mobject,
    palette: dict[str, str],
    label: str = "",
    style: str = "solid",
    curve: float = 0.0,
) -> VGroup:
    start, end = _edge_points(source, target)
    color = _ink(palette)
    normalized = (style or "solid").strip().lower()

    if normalized == "loop" or abs(curve) > 0.01:
        arrow = CurvedArrow(
            start,
            end,
            angle=curve if abs(curve) > 0.01 else 0.65,
            color=color,
            stroke_width=5,
            tip_length=0.18,
        )
        midpoint = arrow.get_center()
    elif normalized == "dashed":
        line = DashedVMobject(Line(start, end), num_dashes=22)
        line.set_stroke(color, width=4.5)
        tip = _arrow_tip(color)
        angle = math.atan2(end[1] - start[1], end[0] - start[0]) - PI / 2
        tip.rotate(angle)
        tip.move_to(end)
        arrow = VGroup(line, tip)
        midpoint = Line(start, end).get_center()
    else:
        arrow = Arrow(
            start,
            end,
            buff=0,
            color=color,
            stroke_width=5,
            tip_length=0.18,
            max_stroke_width_to_length_ratio=10,
        )
        midpoint = arrow.get_center()

    parts = [arrow]

    if label.strip():
        label_text = Text(
            _wrap_copy(label, 18),
            font=UI_FONT,
            font_size=18,
            weight="MEDIUM",
            color=_muted(palette),
        )
        offset = UP * 0.18 if abs(end[0] - start[0]) >= abs(end[1] - start[1]) else RIGHT * 0.18
        label_text.move_to(midpoint + offset)
        parts.append(label_text)

    return VGroup(*parts)
