import { test, expect } from '@playwright/test'

test('carrega a visão geral e navega para pipelines pelo menu lateral', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /pipelines ci\/cd/i })).toBeVisible()
  await page.getByRole('button', { name: /pipelines ci\/cd/i }).click()
  await expect(page).toHaveURL(/#\/pipelines/)
})

test('abre o command palette com o botão de busca e fecha com Escape', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /buscar em toda a plataforma/i }).click()
  await expect(page.locator('.command-palette')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.command-palette')).toBeHidden()
})

test('alterna para o tema claro em Configurações', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Claro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})
