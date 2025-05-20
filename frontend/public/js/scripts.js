var pjax;

function copyLink() {
    const el = document.createElement('textarea');
    el.value = window.location.href;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    const selected = document.getSelection().rangeCount > 0 ? document.getSelection().getRangeAt(0) : false; el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    if (selected) {
        document.getSelection().removeAllRanges();
        document.getSelection().addRange(selected);
    };
    alert('Link copied!');
};

function shareToFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${domain}`, '_blank');
};

function shareToTwitter() {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(window.location.href)}`, '_blank');
};

function shareToWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(window.location.href)}`, '_blank');
};

function shareToTelegram() {
    window.open(`https://telegram.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${document.title.split(" |")[0]}`, '_blank');
};

function shareToLine() {
    window.open(`https://line.me/R/share?text=${encodeURIComponent(window.location.href)}`, '_blank');
};

function load() {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 0) {
            document.querySelector('.toTop').classList.add('visible');
        } else {
            document.querySelector('.toTop').classList.remove('visible');
        };
    });
    try {
        document.querySelectorAll('.images').forEach(slider => {
            classes = "";
            slider.classList.forEach(class1 => { classes += `.${class1}` });
            new Splide(classes, {
                heightRatio: 0.5,
                arrows: (slider.querySelectorAll('.splide__slide').length > 1) ? true : false,
            }).mount();
        });
    } catch { };
    try {
        jQuery(".article-i .split .left .info h1").fitText(1.75);
    } catch { };
    try {
        document.querySelector('.loading').remove();
    } catch { };
    document.querySelector('footer').style.paddingTop = `calc(100vh - ${document.querySelector('footer .inner').clientHeight}px)`;
    document.head.querySelector('title').innerText = document.querySelector('page-title').innerText;
};

load();

document.addEventListener("DOMContentLoaded", function () {
    pjax = new Pjax({
        selectors: ["header", ".pcontent", "[live-pageviews]"],
        switches: {
            "header": Pjax.switches.outerHTML,
            ".pcontent": Pjax.switches.sideBySide,
            "[live-pageviews]": Pjax.switches.outerHTML
        },
        switchesOptions: {
            ".pcontent": {
                classNames: {
                    remove: "Animated Animated--reverse Animate--fast Animate--noDelay",
                    add: "Animated",
                    backward: "Animate--fadeIn",
                    forward: "Animate--fadeOut"
                }
            },
        },
        cacheBust: false,
    });
});

document.addEventListener('pjax:send', (a) => {
    document.querySelectorAll('.loading').forEach(e => e.remove());
    loading = document.createElement('img');
    loading.classList = "loading";
    loading.src = domain + "/images/loading.png";
    document.body.appendChild(loading);
    if (a.triggerElement && a.triggerElement.href.includes('admin')) window.open(a.triggerElement.href, '_blank');
});

document.addEventListener('pjax:complete', load);