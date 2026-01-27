new WOW().init();
const swiper = new Swiper('.swiper', {
    pagination: {
        el: '.projects-pagination',
        bulletClass: 'projects-bullet',
        bulletActiveClass: 'projects-bullet-active',
        clickable: true
    },
});















let swiperInstance = undefined;

function initGallery() {
    const width = window.innerWidth;
    const container = document.querySelector('.swiper-container');
    const wrapper = document.querySelector('.guest-items');
    const slides = document.querySelectorAll('.guest-item');

    // Если ширина экрана 650px и меньше - включаем слайдер
    if (width <= 680) {
        if (!swiperInstance) {
            container.classList.add('swiper');
            wrapper.classList.add('swiper-wrapper');
            slides.forEach(s => s.classList.add('swiper-slide'));

            swiperInstance = new Swiper('.swiper', {
                slidesPerView: 1,
                spaceBetween: 0,
                loop: false,
                centeredSlides: true,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                on: {
                    init: function () {
                        // Исправляем возможный баг с начальным сдвигом
                        setTimeout(() => this.update(), 100);
                    },
                }
            });
        }
    } else {
        // Если экран стал широким - удаляем слайдер и возвращаем Grid стили
        if (swiperInstance) {
            swiperInstance.destroy(true, true);
            swiperInstance = undefined;

            container.classList.remove('swiper');
            wrapper.classList.remove('swiper-wrapper');
            slides.forEach(s => {
                s.classList.remove('swiper-slide');
                s.removeAttribute('style');
            });
            wrapper.removeAttribute('style');
        }
    }
}

// Запуск при загрузке страницы и изменении размеров
window.addEventListener('resize', initGallery);
window.addEventListener('DOMContentLoaded', initGallery);