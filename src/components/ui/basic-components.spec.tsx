/**
 * 基础 UI 组件渲染测试：Button / Badge / Card / Skeleton / Alert / Separator
 *
 * 这些组件只依赖 @tarojs/components（passthrough mock）+ class-variance-authority，
 * 在 jsdom 下可直接渲染。
 */
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { Button, buttonVariants } from './button'
import { Badge, badgeVariants } from './badge'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card'
import { Skeleton } from './skeleton'
import { Alert, AlertTitle, AlertDescription } from './alert'
import { Separator } from './separator'

function rootEl(container: HTMLElement): HTMLElement {
  return container.firstChild as HTMLElement
}

describe('<Button />', () => {
  it('渲染子文本，点击触发 onClick', () => {
    const onClick = jest.fn()
    render(<Button onClick={onClick}>点我</Button>)
    fireEvent.click(screen.getByText('点我'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('variant/size 体现在 className', () => {
    const { container } = render(
      <Button variant="destructive" size="sm">
        删除
      </Button>,
    )
    const expected = buttonVariants({ variant: 'destructive', size: 'sm' }).split(' ')
    rootEl(container)
      .className.split(' ')
      .filter(Boolean)
      .forEach((cls) => expect(expected).toContain(cls))
    expect(rootEl(container).className).toContain('bg-destructive')
  })

  it('disabled → tabIndex=-1，带禁用样式', () => {
    const { container } = render(
      <Button disabled>
        禁用
      </Button>,
    )
    const el = rootEl(container)
    expect(el.getAttribute('tabindex')).toBe('-1')
    expect(el.className).toContain('opacity-50')
    expect(el.className).toContain('pointer-events-none')
  })
})

describe('<Badge />', () => {
  it('渲染文本并带默认 variant class', () => {
    const { container } = render(<Badge>新</Badge>)
    const el = rootEl(container)
    expect(el.textContent).toBe('新')
    el.className
      .split(' ')
      .forEach((cls) => expect(badgeVariants().split(' ')).toContain(cls))
  })

  it('variant=outline 生效', () => {
    const { container } = render(<Badge variant="outline">标签</Badge>)
    expect(rootEl(container).className).toContain('text-foreground')
  })
})

describe('<Card /> 系列', () => {
  it('各子组件组合渲染不崩溃', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>标题</CardTitle>
          <CardDescription>描述</CardDescription>
        </CardHeader>
        <CardContent>内容</CardContent>
        <CardFooter>页脚</CardFooter>
      </Card>,
    )
    expect(screen.getByText('标题')).toBeTruthy()
    expect(screen.getByText('描述')).toBeTruthy()
    expect(screen.getByText('内容')).toBeTruthy()
    expect(screen.getByText('页脚')).toBeTruthy()
  })

  it('自定义 className 透传', () => {
    const { container } = render(<Card className="custom-card">x</Card>)
    expect(rootEl(container).className).toContain('custom-card')
  })
})

describe('<Skeleton />', () => {
  it('渲染并带 animate-pulse class', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />)
    expect(rootEl(container).className).toContain('animate-pulse')
    expect(rootEl(container).className).toContain('h-4')
  })
})

describe('<Alert />', () => {
  it('渲染标题与描述', () => {
    render(
      <Alert>
        <AlertTitle>注意</AlertTitle>
        <AlertDescription>详情文案</AlertDescription>
      </Alert>,
    )
    expect(screen.getByText('注意')).toBeTruthy()
    expect(screen.getByText('详情文案')).toBeTruthy()
  })

  it('默认 variant class 存在', () => {
    const { container } = render(<Alert>x</Alert>)
    expect(rootEl(container).className).toContain('rounded-lg')
  })
})

describe('<Separator />', () => {
  it('默认 horizontal 渲染', () => {
    const { container } = render(<Separator />)
    expect(container.firstChild).toBeTruthy()
  })
})
