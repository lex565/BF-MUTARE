/**
 * The BF Mutare mark and wordmark.
 *
 * This is the client's real logo, not a reconstruction. It was traced from
 * `Images/bfmutarewhite_102403.png` — that file had its white background baked
 * in as opaque pixels rather than as alpha, so the white was knocked out, the
 * antialiased edges un-mixed back to solid colour, and the silhouette traced to
 * a single path. Transparent ground: there is no backing shape in this file, so
 * it drops onto a photo or a video hero without a rectangle around it.
 *
 * Drawn inline rather than loaded as an <img> because the nav is on every route
 * and this saves a request on every page. The standalone files are at
 * `public/logo-mark.svg` (mark only) and `public/logo.svg` (mark + wordmark)
 * for anything off-site.
 *
 * `#d56422` is sampled from the original artwork, not guessed. It is the
 * logo's own colour and deliberately not the same as the site's plate-yellow
 * UI accent — the mark keeps its identity, the interface keeps its signal
 * colour.
 */

/** Traced from the client's artwork. viewBox is the trimmed source bounds. */
const MARK_PATH =
  'M0 919 L323 701 L428 627 L435 624 L441 624 L446 628 L463 665 L468 671 L471 671 L476 666 L488 646 L496 637 L501 634 L508 633 L516 638 L518 643 L519 746 L522 777 L527 794 L536 806 L546 807 L557 802 L569 792 L639 714 L751 576 L791 530 L826 494 L878 450 L933 410 L1062 324 L1086 313 L1092 314 L1097 321 L1095 342 L1074 400 L1044 467 L1032 504 L1023 552 L1023 588 L1027 596 L1039 601 L1049 601 L1059 598 L1092 576 L1131 543 L1189 500 L1231 475 L1238 474 L1240 476 L1239 483 L1219 518 L1152 612 L1103 691 L1086 725 L1085 737 L1088 746 L1094 750 L1103 750 L1120 744 L1154 726 L1221 685 L1257 668 L1281 660 L1292 658 L1311 658 L1321 661 L1330 666 L1339 675 L1347 693 L1348 723 L1337 781 L1316 858 L1268 1017 L1267 1030 L1274 1036 L1281 1038 L1285 1037 L1317 1016 L1409 945 L1572 813 L1639 766 L1667 753 L1676 751 L1692 751 L1702 754 L1707 757 L1721 773 L1727 788 L1732 817 L1731 906 L1736 914 L1744 916 L1752 914 L1761 905 L1779 874 L1841 751 L1852 734 L1861 725 L1882 690 L1912 653 L1929 636 L1939 629 L1952 624 L1968 624 L2089 670 L2109 674 L2094 618 L2096 617 L2561 907 L2100 429 L2090 426 L2079 428 L2054 440 L1989 461 L1829 523 L1787 536 L1760 501 L1677 377 L1665 362 L1638 318 L1607 278 L1599 274 L1592 274 L1583 277 L1488 332 L1479 336 L1469 334 L1292 129 L1221 50 L1196 19 L1180 4 L1174 0 L1171 0 L1164 4 L879 324 L862 341 L847 350 L780 374 L768 381 L755 394 L717 446 L677 506 L646 548 L638 556 L632 557 L628 555 L497 416 L492 413 L484 413 L480 415 Z'

export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 2562 1039"
      className={className}
      role="img"
      aria-label="BF Mutare"
      focusable="false"
    >
      {/* evenodd keeps the gaps between the peaks open rather than filling
          them in — with the default nonzero rule the snow slivers close up. */}
      <path fill="#d56422" fillRule="evenodd" d={MARK_PATH} />
    </svg>
  )
}

/**
 * Mark plus wordmark, as used in the header and footer.
 *
 * The mark is much wider than it is tall (2562×1039), so it is sized by width
 * and sits beside the wordmark rather than above it.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <LogoMark className="h-auto w-11 shrink-0" />
      <span className="font-display text-lead font-bold uppercase leading-none tracking-tight">
        BF <span className="text-accent">Mutare</span>
      </span>
    </span>
  )
}
