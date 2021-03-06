from django.conf.urls import include, url
from django.contrib.auth import views as auth_views
from django.contrib import admin

admin.autodiscover()  # For Django 1.6


urlpatterns = [
    url(r'^admin/', admin.site.urls),
    url(r'^selectable/', include('selectable.urls')),
    url(r'', include('timepiece.urls')),

    # authentication views
    url(r'^accounts/login/$', auth_views.LoginView.as_view(), name='auth_login'),
    url(r'^accounts/logout/$', auth_views.LogoutView,
        name='auth_logout'),
    url(r'^accounts/password-change/$',
        auth_views.PasswordChangeView,
        name='change_password'),
    url(r'^accounts/password_reset/$',
    auth_views.PasswordResetView.as_view(template_name='password_reset_form.html'),name='password_reset'),

    # url(r'^accounts/password-change/done/$',
    #     auth_views.password_change_done),
    # url(r'^accounts/password-reset/$',
    #     auth_views.password_reset,
    #     name='reset_password'),
    # url(r'^accounts/password-reset/done/$',
    #     auth_views.password_reset_done),
    # url(r'^accounts/reset/(?P<uidb36>[0-9A-Za-z]+)-(?P<token>.+)/$',
    #     auth_views.password_reset_confirm),
    # url(r'^accounts/reset/done/$',
    #     auth_views.password_reset_complete),
]
